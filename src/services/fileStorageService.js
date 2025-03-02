/**
 * File Storage Service
 * 
 * Servizio per la gestione dello storage dei documenti utilizzando MinIO/S3.
 * Supporta caricamento, recupero, eliminazione di file, nonché funzionalità
 * avanzate come generazione di thumbnail, rotazione PDF e unione documenti.
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, 
        HeadObjectCommand, CreateBucketCommand, PutObjectTaggingCommand,
        CopyObjectCommand, GetObjectTaggingCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const PdfMerger = require('pdf-merger-js');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { logger } = require('../utils/logger');

// Configurazione S3/MinIO
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
const S3_REGION = process.env.S3_REGION || 'eu-south-1';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_DEFAULT_BUCKET = process.env.S3_DEFAULT_BUCKET || 'assistente-biliato';
const S3_PUBLIC_BUCKET = process.env.S3_PUBLIC_BUCKET || 'assistente-biliato-public';
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === 'true';
const S3_RETRIES = parseInt(process.env.S3_RETRIES) || 3;

// Configurazione Thumbnail
const THUMBNAIL_WIDTH = parseInt(process.env.THUMBNAIL_WIDTH) || 300;
const THUMBNAIL_QUALITY = parseInt(process.env.THUMBNAIL_QUALITY) || 80;

// Configurazione per chunked upload
const UPLOAD_CHUNK_SIZE = parseInt(process.env.UPLOAD_CHUNK_SIZE) || 5 * 1024 * 1024; // 5MB default

// Istanza client S3
let s3Client = null;

/**
 * Inizializza il client S3/MinIO
 * @returns {S3Client} Istanza client S3
 */
const initializeS3Client = () => {
  if (s3Client) return s3Client;
  
  try {
    // Verifica credenziali
    if (!S3_ACCESS_KEY || !S3_SECRET_KEY) {
      throw new Error('Credenziali S3/MinIO mancanti. Imposta S3_ACCESS_KEY e S3_SECRET_KEY nelle variabili d\'ambiente.');
    }
    
    // Configurazione client
    s3Client = new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY
      },
      forcePathStyle: S3_FORCE_PATH_STYLE, // Necessario per MinIO
      maxAttempts: S3_RETRIES
    });
    
    logger.info(`Client S3/MinIO inizializzato con endpoint: ${S3_ENDPOINT}`);
    return s3Client;
  } catch (error) {
    logger.error('Errore nell\'inizializzazione del client S3/MinIO:', error);
    throw error;
  }
};

/**
 * Genera una chiave S3 univoca per un file
 * @param {string} clientId - ID del cliente
 * @param {string} originalFilename - Nome originale del file
 * @param {string} category - Categoria documento (opzionale)
 * @returns {string} Chiave S3 univoca
 */
const generateS3Key = (clientId, originalFilename, category = 'general') => {
  // Sanitizza il nome file
  const sanitizedFilename = originalFilename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();
  
  // Genera timestamp e hash per unicità
  const timestamp = Date.now();
  const hash = crypto.createHash('md5')
    .update(`${clientId}_${originalFilename}_${timestamp}`)
    .digest('hex')
    .substring(0, 8);
  
  // Estrai estensione
  const extension = path.extname(sanitizedFilename);
  const basename = path.basename(sanitizedFilename, extension);
  
  // Formatta: clients/{clientId}/{category}/{basename}_{timestamp}_{hash}{extension}
  return `clients/${clientId}/${category}/${basename}_${timestamp}_${hash}${extension}`;
};

/**
 * Carica un file su S3/MinIO
 * @param {Object} options - Opzioni di caricamento
 * @param {string} options.clientId - ID del cliente
 * @param {string} options.originalFilename - Nome originale del file
 * @param {Buffer|string} options.fileContent - Contenuto del file (Buffer o percorso)
 * @param {string} options.mimeType - MIME type del file
 * @param {string} options.category - Categoria documento
 * @param {Object} options.metadata - Metadati del documento
 * @param {Array} options.tags - Tag per il file
 * @param {boolean} options.isPublic - Se il file deve essere pubblico
 * @returns {Promise<Object>} Dettagli del file caricato
 */
const uploadFile = async (options) => {
  const {
    clientId,
    originalFilename,
    fileContent,
    mimeType,
    category = 'general',
    metadata = {},
    tags = [],
    isPublic = false
  } = options;
  
  if (!clientId || !originalFilename || !fileContent) {
    throw new Error('Parametri mancanti per uploadFile: clientId, originalFilename, fileContent sono obbligatori');
  }
  
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Genera chiave S3
    const s3Key = generateS3Key(clientId, originalFilename, category);
    
    // Seleziona bucket in base alla visibilità
    const bucketName = isPublic ? S3_PUBLIC_BUCKET : S3_DEFAULT_BUCKET;
    
    // Preparazione contenuto del file
    let content;
    let contentLength;
    
    if (Buffer.isBuffer(fileContent)) {
      content = fileContent;
      contentLength = fileContent.length;
    } else if (typeof fileContent === 'string') {
      // Assumiamo che sia un percorso file
      if (!fs.existsSync(fileContent)) {
        throw new Error(`File non trovato: ${fileContent}`);
      }
      content = fs.createReadStream(fileContent);
      const stats = fs.statSync(fileContent);
      contentLength = stats.size;
    } else {
      throw new Error('fileContent deve essere un Buffer o un percorso file');
    }
    
    // Preparazione metadati
    const s3Metadata = {
      'Content-Type': mimeType,
      'x-amz-meta-client-id': clientId,
      'x-amz-meta-original-filename': encodeURIComponent(originalFilename),
      'x-amz-meta-category': category,
      ...Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
          `x-amz-meta-${key}`,
          typeof value === 'string' ? value : JSON.stringify(value)
        ])
      )
    };
    
    // Verifica dimensione file per decidere se usare upload in chunk
    const useChunkedUpload = contentLength > UPLOAD_CHUNK_SIZE;
    
    let uploadResult;
    
    if (useChunkedUpload) {
      // Upload in chunk per file grandi
      logger.info(`Avvio upload in chunk per file grande (${Math.round(contentLength / 1024 / 1024)}MB): ${s3Key}`);
      
      const multipartUpload = new Upload({
        client,
        params: {
          Bucket: bucketName,
          Key: s3Key,
          Body: content,
          ContentType: mimeType,
          Metadata: Object.fromEntries(
            Object.entries(s3Metadata).map(([key, value]) => [
              key.replace('x-amz-meta-', ''),
              value
            ])
          )
        },
        partSize: UPLOAD_CHUNK_SIZE
      });
      
      uploadResult = await multipartUpload.done();
    } else {
      // Upload standard per file piccoli
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: content,
        ContentType: mimeType,
        Metadata: Object.fromEntries(
          Object.entries(s3Metadata).map(([key, value]) => [
            key.replace('x-amz-meta-', ''),
            value
          ])
        )
      });
      
      uploadResult = await client.send(command);
    }
    
    // Aggiungi tag se presenti
    if (tags && tags.length > 0) {
      const tagSet = tags.map(tag => {
        if (typeof tag === 'string') {
          return { Key: tag, Value: 'true' };
        } else if (tag.key && tag.value) {
          return { Key: tag.key, Value: tag.value };
        }
        return null;
      }).filter(tag => tag !== null);
      
      if (tagSet.length > 0) {
        await client.send(new PutObjectTaggingCommand({
          Bucket: bucketName,
          Key: s3Key,
          Tagging: { TagSet: tagSet }
        }));
      }
    }
    
    logger.info(`File caricato con successo: ${s3Key}`);
    
    return {
      key: s3Key,
      bucket: bucketName,
      filename: path.basename(s3Key),
      originalName: originalFilename,
      size: contentLength,
      mimeType,
      category,
      path: `${bucketName}/${s3Key}`,
      isPublic,
      eTag: uploadResult.ETag?.replace(/"/g, '') || null,
      uploadDate: new Date().toISOString(),
      metadata
    };
  } catch (error) {
    logger.error(`Errore nel caricamento del file ${originalFilename}:`, error);
    throw new Error(`Errore nel caricamento del file: ${error.message}`);
  }
};

/**
 * Genera un URL presigned per accesso temporaneo a un file
 * @param {string} key - Chiave S3 del file
 * @param {string} bucket - Nome del bucket (opzionale)
 * @param {number} expiresIn - Durata URL in secondi (default 3600)
 * @param {string} action - Azione permessa (getObject, putObject, etc.)
 * @returns {Promise<string>} URL presigned
 */
const getFileUrl = async (key, bucket = S3_DEFAULT_BUCKET, expiresIn = 3600, action = 'getObject') => {
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Crea comando in base all'azione richiesta
    let command;
    
    switch (action) {
      case 'getObject':
        command = new GetObjectCommand({ Bucket: bucket, Key: key });
        break;
      case 'putObject':
        command = new PutObjectCommand({ Bucket: bucket, Key: key });
        break;
      default:
        throw new Error(`Azione non supportata: ${action}`);
    }
    
    // Genera URL presigned
    const url = await getSignedUrl(client, command, { expiresIn });
    
    return url;
  } catch (error) {
    logger.error(`Errore nella generazione dell'URL per ${key}:`, error);
    throw new Error(`Errore nella generazione dell'URL: ${error.message}`);
  }
};

/**
 * Elimina un file da S3/MinIO
 * @param {string} key - Chiave S3 del file
 * @param {string} bucket - Nome del bucket (opzionale)
 * @returns {Promise<boolean>} Esito dell'operazione
 */
const deleteFile = async (key, bucket = S3_DEFAULT_BUCKET) => {
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Elimina il file
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );
    
    logger.info(`File eliminato con successo: ${bucket}/${key}`);
    return true;
  } catch (error) {
    logger.error(`Errore nell'eliminazione del file ${key}:`, error);
    throw new Error(`Errore nell'eliminazione del file: ${error.message}`);
  }
};

/**
 * Verifica l'esistenza di un file
 * @param {string} key - Chiave S3 del file
 * @param {string} bucket - Nome del bucket (opzionale)
 * @returns {Promise<boolean>} Se il file esiste
 */
const checkFileExists = async (key, bucket = S3_DEFAULT_BUCKET) => {
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Verifica esistenza
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );
    
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    
    logger.error(`Errore nella verifica dell'esistenza del file ${key}:`, error);
    throw new Error(`Errore nella verifica dell'esistenza del file: ${error.message}`);
  }
};

/**
 * Recupera un file da S3/MinIO
 * @param {string} key - Chiave S3 del file
 * @param {string} bucket - Nome del bucket (opzionale)
 * @param {string} outputPath - Percorso di output locale (opzionale)
 * @returns {Promise<Buffer|string>} Contenuto del file o percorso locale
 */
const getFile = async (key, bucket = S3_DEFAULT_BUCKET, outputPath = null) => {
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Ottieni il file
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
    
    const response = await client.send(command);
    
    if (outputPath) {
      // Salva su file locale
      await pipeline(
        response.Body,
        fs.createWriteStream(outputPath)
      );
      
      return outputPath;
    } else {
      // Restituisci come Buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      
      return Buffer.concat(chunks);
    }
  } catch (error) {
    logger.error(`Errore nel recupero del file ${key}:`, error);
    throw new Error(`Errore nel recupero del file: ${error.message}`);
  }
};

/**
 * Crea una miniatura per un'immagine o documento
 * @param {string} key - Chiave S3 del file
 * @param {string} bucket - Nome del bucket (opzionale)
 * @param {Object} options - Opzioni per la miniatura
 * @returns {Promise<Object>} Dettagli della miniatura generata
 */
const generateThumbnail = async (key, bucket = S3_DEFAULT_BUCKET, options = {}) => {
  const {
    width = THUMBNAIL_WIDTH,
    quality = THUMBNAIL_QUALITY,
    format = 'webp',
    thumbnailPrefix = 'thumb_'
  } = options;
  
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Verifica formato supportato
    const supportedImageFormats = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.gif'];
    const fileExt = path.extname(key).toLowerCase();
    
    // Ottieni file originale
    const fileContent = await getFile(key, bucket);
    
    // Prepara chiave per thumbnail
    const keyParts = key.split('/');
    const filename = keyParts.pop();
    const thumbnailKey = [...keyParts, `${thumbnailPrefix}${filename}`].join('/');
    
    let thumbnailBuffer;
    
    if (supportedImageFormats.includes(fileExt)) {
      // Genera thumbnail da immagine
      thumbnailBuffer = await sharp(fileContent)
        .resize({
          width,
          withoutEnlargement: true
        })
        .toFormat(format, { quality })
        .toBuffer();
    } else if (fileExt === '.pdf') {
      // Genera thumbnail da PDF (prima pagina)
      const tempPdfPath = path.join('/tmp', `temp_${Date.now()}.pdf`);
      const tempImgPath = path.join('/tmp', `temp_${Date.now()}.png`);
      
      try {
        // Salva PDF temporaneamente
        await fs.promises.writeFile(tempPdfPath, fileContent);
        
        // Estrai prima pagina con pdf-lib
        const pdfDoc = await PDFDocument.load(fileContent);
        const pdfBytes = await pdfDoc.copyPages(pdfDoc, [0]).save();
        
        // Usa sharp per creare thumbnail
        thumbnailBuffer = await sharp(tempImgPath)
          .resize({
            width,
            withoutEnlargement: true
          })
          .toFormat(format, { quality })
          .toBuffer();
      } finally {
        // Pulizia file temporanei
        try {
          if (fs.existsSync(tempPdfPath)) await fs.promises.unlink(tempPdfPath);
          if (fs.existsSync(tempImgPath)) await fs.promises.unlink(tempImgPath);
        } catch (err) {
          logger.warn('Errore nella pulizia dei file temporanei:', err);
        }
      }
    } else {
      throw new Error(`Formato file non supportato per thumbnail: ${fileExt}`);
    }
    
    // Carica thumbnail
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: `image/${format}`,
        Metadata: {
          'x-amz-meta-thumbnail-of': key,
          'x-amz-meta-thumbnail-width': width.toString(),
          'x-amz-meta-thumbnail-quality': quality.toString()
        }
      })
    );
    
    logger.info(`Thumbnail generata con successo: ${thumbnailKey}`);
    
    return {
      key: thumbnailKey,
      bucket,
      originalKey: key,
      format,
      width,
      size: thumbnailBuffer.length,
      path: `${bucket}/${thumbnailKey}`,
      contentType: `image/${format}`
    };
  } catch (error) {
    logger.error(`Errore nella generazione della thumbnail per ${key}:`, error);
    throw new Error(`Errore nella generazione della thumbnail: ${error.message}`);
  }
};

/**
 * Crea un bucket per un cliente
 * @param {string} clientId - ID del cliente
 * @param {Object} options - Opzioni del bucket
 * @returns {Promise<Object>} Dettagli del bucket creato
 */
const createBucket = async (clientId, options = {}) => {
  const {
    region = S3_REGION,
    isPublic = false,
    tags = []
  } = options;
  
  if (!clientId) {
    throw new Error('clientId è obbligatorio per la creazione del bucket');
  }
  
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Sanitizza ID cliente per nome bucket
    const sanitizedClientId = clientId.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const bucketName = `assistente-biliato-client-${sanitizedClientId}`;
    
    // Crea bucket
    await client.send(
      new CreateBucketCommand({
        Bucket: bucketName,
        ACL: isPublic ? 'public-read' : 'private',
        CreateBucketConfiguration: {
          LocationConstraint: region
        }
      })
    );
    
    // Aggiungi tag al bucket se presenti
    if (tags && tags.length > 0) {
      // Nota: per i tag del bucket è necessario usare l'API separata di tagging bucket
      // che richiede autorizzazioni aggiuntive
      logger.info(`Bucket creato con successo: ${bucketName}, i tag verranno applicati separatamente`);
    } else {
      logger.info(`Bucket creato con successo: ${bucketName}`);
    }
    
    return {
      bucket: bucketName,
      clientId,
      isPublic,
      region,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Errore nella creazione del bucket per il cliente ${clientId}:`, error);
    throw new Error(`Errore nella creazione del bucket: ${error.message}`);
  }
};

/**
 * Ruota le pagine di un PDF
 * @param {string} key - Chiave S3 del file PDF
 * @param {string} bucket - Nome del bucket (opzionale)
 * @param {Array} rotations - Array di oggetti {page: numero, angle: angolo}
 * @returns {Promise<Object>} Dettagli del file ruotato
 */
const rotatePDF = async (key, bucket = S3_DEFAULT_BUCKET, rotations = []) => {
  try {
    // Verifica se il file è un PDF
    if (!key.toLowerCase().endsWith('.pdf')) {
      throw new Error('Il file deve essere un PDF');
    }
    
    if (!Array.isArray(rotations) || rotations.length === 0) {
      throw new Error('L\'array di rotazioni è obbligatorio e deve contenere almeno un elemento');
    }
    
    // Ottieni file PDF
    const pdfBuffer = await getFile(key, bucket);
    
    // Carica PDF con pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pagesCount = pdfDoc.getPageCount();
    
    // Applica rotazioni
    for (const rotation of rotations) {
      const { page, angle } = rotation;
      
      // Verifica validità della pagina
      if (page < 1 || page > pagesCount) {
        logger.warn(`Pagina ${page} fuori range (1-${pagesCount}), ignorata`);
        continue;
      }
      
      // Verifica validità dell'angolo (supporta solo multipli di 90)
      const normalizedAngle = (Math.round(angle / 90) * 90) % 360;
      if (normalizedAngle !== angle) {
        logger.warn(`Angolo ${angle}° non supportato, arrotondato a ${normalizedAngle}°`);
      }
      
      // Applica rotazione
      const pdfPage = pdfDoc.getPage(page - 1);
      pdfPage.setRotation({
        angle: normalizedAngle
      });
      
      logger.info(`Pagina ${page} ruotata di ${normalizedAngle}°`);
    }
    
    // Salva PDF modificato
    const modifiedPdfBuffer = await pdfDoc.save();
    
    // Genera chiave per file ruotato
    const keyParts = key.split('/');
    const filename = keyParts.pop();
    const rotatedFilename = `rotated_${filename}`;
    const rotatedKey = [...keyParts, rotatedFilename].join('/');
    
    // Carica PDF modificato
    await uploadFile({
      clientId: keyParts[1], // Assumiamo path: clients/{clientId}/...
      originalFilename: rotatedFilename,
      fileContent: modifiedPdfBuffer,
      mimeType: 'application/pdf',
      category: keyParts[2] || 'general', // Assumiamo path: clients/{clientId}/{category}/...
      metadata: {
        source: key,
        rotations: JSON.stringify(rotations),
        processedAt: new Date().toISOString()
      }
    });
    
    return {
      key: rotatedKey,
      bucket,
      originalKey: key,
      rotations,
      pagesCount,
      size: modifiedPdfBuffer.length,
      path: `${bucket}/${rotatedKey}`,
      contentType: 'application/pdf'
    };
  } catch (error) {
    logger.error(`Errore nella rotazione del PDF ${key}:`, error);
    throw new Error(`Errore nella rotazione del PDF: ${error.message}`);
  }
};

/**
 * Unisce più documenti PDF in uno solo
 * @param {Array} files - Array di oggetti {key, bucket}
 * @param {string} outputName - Nome del file risultante
 * @param {string} clientId - ID del cliente
 * @param {string} category - Categoria documento
 * @returns {Promise<Object>} Dettagli del file unito
 */
const mergeDocuments = async (files, outputName, clientId, category = 'general') => {
  if (!Array.isArray(files) || files.length < 2) {
    throw new Error('Almeno due file sono necessari per l\'unione');
  }
  
  if (!outputName || !clientId) {
    throw new Error('outputName e clientId sono obbligatori');
  }
  
  try {
    // Preparazione file temporanei
    const tempFiles = [];
    const merger = new PdfMerger();
    
    // Scarica e aggiungi ogni file
    for (const [index, file] of files.entries()) {
      const { key, bucket = S3_DEFAULT_BUCKET } = file;
      
      // Verifica che il file sia un PDF
      if (!key.toLowerCase().endsWith('.pdf')) {
        throw new Error(`Il file ${index + 1} (${key}) non è un PDF`);
      }
      
      try {
        // Scarica il file
        const tempFilePath = path.join('/tmp', `merge_temp_${Date.now()}_${index}.pdf`);
        await getFile(key, bucket, tempFilePath);
        tempFiles.push(tempFilePath);
        
        // Aggiungi al merger
        await merger.add(tempFilePath);
        logger.info(`File ${index + 1}/${files.length} aggiunto alla fusione: ${key}`);
      } catch (error) {
        throw new Error(`Errore nel recupero del file ${key}: ${error.message}`);
      }
    }
    
    // Crea file unito temporaneo
    const tempOutputPath = path.join('/tmp', `merged_${Date.now()}.pdf`);
    await merger.save(tempOutputPath);
    
    // Assicura che outputName abbia estensione .pdf
    const outputFilename = outputName.toLowerCase().endsWith('.pdf') 
      ? outputName 
      : `${outputName}.pdf`;
    
    // Carica file unito
    const result = await uploadFile({
      clientId,
      originalFilename: outputFilename,
      fileContent: tempOutputPath,
      mimeType: 'application/pdf',
      category,
      metadata: {
        source: 'merge',
        sourceFiles: JSON.stringify(files.map(f => `${f.bucket || S3_DEFAULT_BUCKET}/${f.key}`)),
        mergeDate: new Date().toISOString()
      }
    });
    
    // Pulizia file temporanei
    for (const tempFile of [...tempFiles, tempOutputPath]) {
      try {
        if (fs.existsSync(tempFile)) {
          await fs.promises.unlink(tempFile);
        }
      } catch (err) {
        logger.warn(`Errore nella pulizia del file temporaneo ${tempFile}:`, err);
      }
    }
    
    return {
      ...result,
      sourceFiles: files,
      pagesCount: (await merger.toArrayBuffer()).pages || files.length
    };
  } catch (error) {
    logger.error('Errore nella fusione dei documenti:', error);
    throw new Error(`Errore nella fusione dei documenti: ${error.message}`);
  }
};

/**
 * Replica un file tra bucket per resilienza
 * @param {string} sourceKey - Chiave S3 del file di origine
 * @param {string} sourceBucket - Bucket di origine
 * @param {string} targetBucket - Bucket di destinazione
 * @param {Object} options - Opzioni aggiuntive
 * @returns {Promise<Object>} Dettagli dell'operazione
 */
const replicateFile = async (sourceKey, sourceBucket, targetBucket, options = {}) => {
  const {
    newKey = null,
    metadata = {},
    preserveTags = true
  } = options;
  
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Genera chiave di destinazione se non specificata
    const destinationKey = newKey || sourceKey;
    
    // Copia il file
    await client.send(
      new CopyObjectCommand({
        Bucket: targetBucket,
        CopySource: `${sourceBucket}/${sourceKey}`,
        Key: destinationKey,
        MetadataDirective: Object.keys(metadata).length > 0 ? 'REPLACE' : 'COPY',
        Metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      })
    );
    
    // Copia tag se richiesto
    if (preserveTags) {
      try {
        const tagsResponse = await client.send(
          new GetObjectTaggingCommand({
            Bucket: sourceBucket,
            Key: sourceKey
          })
        );
        
        if (tagsResponse.TagSet && tagsResponse.TagSet.length > 0) {
          await client.send(
            new PutObjectTaggingCommand({
              Bucket: targetBucket,
              Key: destinationKey,
              Tagging: { TagSet: tagsResponse.TagSet }
            })
          );
        }
      } catch (tagError) {
        logger.warn(`Errore nel copiare i tag per ${sourceKey}:`, tagError);
      }
    }
    
    logger.info(`File replicato con successo: ${sourceBucket}/${sourceKey} -> ${targetBucket}/${destinationKey}`);
    
    return {
      sourceKey,
      sourceBucket,
      destinationKey,
      destinationBucket: targetBucket,
      replicatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Errore nella replica del file ${sourceKey}:`, error);
    throw new Error(`Errore nella replica del file: ${error.message}`);
  }
};

/**
 * Imposta la policy di retention su un file
 * @param {string} key - Chiave S3 del file
 * @param {string} bucket - Nome del bucket
 * @param {Object} policy - Configurazione della policy
 * @returns {Promise<Object>} Dettagli dell'operazione
 */
const setRetentionPolicy = async (key, bucket, policy = {}) => {
  const {
    retentionPeriod, // Numero di giorni
    legalHold = false,
    basis = 'COMPLIANCE'
  } = policy;
  
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Imposta metadati di retention
    const metadata = {
      'x-amz-meta-retention-period': retentionPeriod?.toString() || '365',
      'x-amz-meta-retention-basis': basis,
      'x-amz-meta-retention-expiry': new Date(Date.now() + (retentionPeriod || 365) * 24 * 60 * 60 * 1000).toISOString(),
      'x-amz-meta-legal-hold': legalHold ? 'ON' : 'OFF'
    };
    
    // Aggiorna metadati del file
    const copyCommand = new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: key,
      MetadataDirective: 'REPLACE',
      Metadata: metadata
    });
    
    await client.send(copyCommand);
    
    // Nota: MinIO/S3 supporta Object Lock per retention legale, ma richiede
    // configurazione speciale del bucket. Qui usiamo i metadati come alternativa.
    
    logger.info(`Policy di retention impostata per ${bucket}/${key}: ${retentionPeriod} giorni`);
    
    return {
      key,
      bucket,
      policy: {
        retentionPeriod: retentionPeriod || 365,
        basis,
        legalHold,
        expiryDate: metadata['x-amz-meta-retention-expiry'],
        setAt: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error(`Errore nell'impostazione della policy di retention per ${key}:`, error);
    throw new Error(`Errore nell'impostazione della policy di retention: ${error.message}`);
  }
};

/**
 * Salva metadati avanzati per un file
 * @param {string} key - Chiave S3 del file
 * @param {string} bucket - Nome del bucket
 * @param {Object} metadata - Metadati da salvare
 * @returns {Promise<Object>} Metadati aggiornati
 */
const updateFileMetadata = async (key, bucket, metadata = {}) => {
  try {
    // Inizializza client S3 se necessario
    const client = initializeS3Client();
    
    // Ottieni metadati esistenti
    const headResponse = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key
      })
    );
    
    const existingMetadata = headResponse.Metadata || {};
    
    // Prepara nuovi metadati (unione di esistenti e nuovi)
    const newMetadata = {
      ...existingMetadata,
      ...Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [
          key.startsWith('x-amz-meta-') ? key : `x-amz-meta-${key}`,
          typeof value === 'string' ? value : JSON.stringify(value)
        ])
      )
    };
    
    // Aggiorna metadati con copy
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${key}`,
        Key: key,
        MetadataDirective: 'REPLACE',
        Metadata: Object.fromEntries(
          Object.entries(newMetadata).map(([key, value]) => [
            key.replace('x-amz-meta-', ''),
            value
          ])
        )
      })
    );
    
    logger.info(`Metadati aggiornati per ${bucket}/${key}`);
    
    return {
      key,
      bucket,
      metadata: newMetadata,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Errore nell'aggiornamento dei metadati per ${key}:`, error);
    throw new Error(`Errore nell'aggiornamento dei metadati: ${error.message}`);
  }
};

// Inizializza il client S3 all'avvio
try {
  initializeS3Client();
} catch (error) {
  logger.warn('File Storage Service: inizializzazione client S3 fallita. Il servizio sarà inizializzato alla prima richiesta.');
}

module.exports = {
  // Funzioni di base
  uploadFile,
  getFileUrl,
  getFile,
  deleteFile,
  checkFileExists,
  
  // Funzionalità avanzate
  generateThumbnail,
  createBucket,
  rotatePDF,
  mergeDocuments,
  
  // Ottimizzazioni e resilienza
  replicateFile,
  setRetentionPolicy,
  
  // Metadati e tagging
  updateFileMetadata,
  
  // Utilità
  generateS3Key
};