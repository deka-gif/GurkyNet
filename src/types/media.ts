export interface Media {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  width?: number;
  height?: number;
  altText?: string;
  folder?: string;
  storageDisk?: string;
  url: string;
  uploadedBy?: string;
  createdAt?: string;
}

export interface MediaFilters {
  keyword?: string;
  folder?: string;
  extension?: string;
  mime_type?: string;
  per_page?: number;
  page?: number;
}
