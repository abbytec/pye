
export interface VirusTotalScanResult {
    data: VirusTotalData;
}

export interface VirusTotalData {
    attributes: VirusTotalAttributes;
    id: string;
    type: string; 
    links: VirusTotalLinks;
    sha256: string;
}

export interface VirusTotalAttributes {
    date: string;
    results: { [key: string]: VirusTotalEngineResult }; 
    stats: VirusTotalStats;
    last_analysis_date: number; 
    last_analysis_results: { [key: string]: VirusTotalEngineResult }; 
    total_votes: VirusTotalVotes;
}

export interface VirusTotalEngineResult {
    category: string; 
    engine_name: string;
    engine_version: string; 
    method: string;
    result: string | null;
}

export interface VirusTotalStats {
    harmless: number;
    malicious: number;
    suspicious: number;
    undetected: number;
    timeout: number;
}

export interface VirusTotalVotes {
    harmless: number;
    malicious: number;
}

export interface VirusTotalFileInfo {
    md5: string;
    sha1: string;
    sha256: string; 
    size: number;
    type_description: string; 
}

export interface VirusTotalURLInfo {
    id: string;
    url: string;
}

export interface VirusTotalLinks {
    self: string; 
    item: string; 
}

export interface VirusTotalAnalysisResult {
    data: {
        attributes: {
            date: number; 
            results: { [key: string]: VirusTotalEngineResult };
            stats: VirusTotalAnalysisStats; 
            status: string;
        };
        links: {
            self: string;
            item: string;
        }
        id: string; 
    },
    type: string; 
    meta: {
        file_info: VirusTotalFileInfo
        url_info: VirusTotalURLInfo
    }
}

export interface VirusTotalEngineResult {
    category: string; 
    engine_name: string; 
    engine_version: string;
    engine_update: string; 
    method: string; 
    result: string | null; 
}

export interface VirusTotalAnalysisStats {
    "confirmed-timeout": number; 
    failure: number; 
    harmless: number; 
    malicious: number;
    suspicious: number; 
    timeout: number; 
    "type-unsupported": number; 
    undetected: number; 
}
