declare module 'clamscan' {
  export interface ClamScanOptions {
    removeInfected?: boolean;
    quarantineInfected?: boolean | string;
    scanLog?: string | null;
    debugMode?: boolean;
    fileList?: string | null;
    scanRecursively?: boolean;
    clamscan?: {
      path?: string | null;
      db?: string | null;
      scanArchives?: boolean;
      active?: boolean;
    };
    clamdscan?: {
      socket?: string | false;
      host?: string | false;
      port?: number | false;
      timeout?: number;
      localFallback?: boolean;
      path?: string | null;
      configFile?: string | null;
      multiscan?: boolean;
      reloadDb?: boolean;
      active?: boolean;
      bypassTest?: boolean;
      tls?: boolean;
    };
    preference?: 'clamscan' | 'clamdscan';
  }

  export interface ClamScan {
    init(config?: ClamScanOptions): Promise<ClamScanInstance>;
  }

  export interface ClamScanInstance {
    scanFile(path: string): Promise<ScanResult>;
    scanBuffer(buffer: Buffer): Promise<ScanResult>;
    scanStream(stream: import('stream').Readable): Promise<ScanResult>;
    isInfected(pathOrBuffer: string | Buffer): Promise<boolean | string[]>;
    passthrough(): import('stream').Duplex;
    getVersion(): Promise<string>;
  }

  export interface ScanResult {
    isInfected: boolean;
    viruses: string[];
  }

  export default class NodeClam implements ClamScan {
    constructor(options?: ClamScanOptions);
    init(config?: ClamScanOptions): Promise<ClamScanInstance>;
  }
}
