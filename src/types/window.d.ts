/**
 * Global type declarations for browser APIs
 */

// File System Access API types
interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
}

interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
    }>;
    excludeAcceptAllOption?: boolean;
}

interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
    getFile(): Promise<File>;
    isSameEntry(other: FileSystemFileHandle): Promise<boolean>;
    readonly kind: 'file';
    readonly name: string;
}

// Extend Window interface
declare global {
    interface Window {
        showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
        Buffer?: typeof import('buffer').Buffer;
    }
}

export { };
