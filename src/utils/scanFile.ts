import { Readable } from 'stream';
import ClamScan from 'clamscan';

const AV = new ClamScan();

const clamscan = await AV.init({
  clamscan: {
    path: null,
  },
  clamdscan: {
    host: 'localhost',
    port: 3310,
    socket: false,
    path: null,
    timeout: 30000,
  },
});

interface Upload {
  name: string;
  size: number;
  data: Buffer | string | Uint8Array;
}

interface VirusScanResult {
  isInfected: boolean;
  viruses: string[];
}

export interface ScanResult {
  name: string;
  is_infected: boolean;
  viruses: string[];
}

export const scanFile = async (
  upload: Upload
): Promise<ScanResult> => {
  if (upload.size <= 0) {
    return {
      name: upload.name,
      is_infected: false,
      viruses: [],
    };
  }

  try {

    let chunk = Buffer.isBuffer(upload.data)
      ? upload.data
      : Buffer.from(upload.data);

    const fileStream = new Readable({
      read() {
        this.push(chunk);
        this.push(null);
        chunk = null as any;
      },
    });

    const tcpStream = clamscan.passthrough();

    fileStream.pipe(tcpStream);

    const result: VirusScanResult = await new Promise((resolve, reject) => {
      tcpStream
        .on('scan-complete', (data: VirusScanResult) => resolve(data))
        .on('error', reject)
        .on('timeout', reject);
    });

    return {
      name: upload.name,
      is_infected: result.isInfected,
      viruses: result.viruses,
    };

  } catch (error) {
    console.error(`Error escaneando archivo ${upload.name}:`, error);
    return {
      name: upload.name,
      is_infected: false,
      viruses: [],
    };
  }
};


export default scanFile;
