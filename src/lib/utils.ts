import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// encryptionUtils.ts
export const getEncryptionKey = async (): Promise<CryptoKey> => {
  const KEY_NAME = 'mumbai-ka-sea-face-office';
  
  const storedKey = localStorage.getItem(KEY_NAME);
  if (storedKey) {
    const keyData = JSON.parse(storedKey);
    return await crypto.subtle.importKey(
      'jwk',
      keyData,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }
  
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  const exportedKey = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(KEY_NAME, JSON.stringify(exportedKey));
  
  return key;
};

export const encryptValue = async (value: string): Promise<string> => {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(value)
  );
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
};

export const decryptValue = async (encryptedValue: string): Promise<string> => {
  const key = await getEncryptionKey();
  
  const binaryString = atob(encryptedValue);
  const combined = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    combined[i] = binaryString.charCodeAt(i);
  }
  
  const iv = combined.slice(0, 12);
  const encryptedData = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );
  
  return new TextDecoder().decode(decrypted);
};

export const encryptObject = async (obj: any): Promise<any> => {
  if (typeof obj === 'string') {
    return await encryptValue(obj);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      return Promise.all(obj.map(encryptObject));
    }
    
    const result: any = {};
    for (const key in obj) {
      result[key] = await encryptObject(obj[key]);
    }
    return result;
  }
  
  return obj;
};

export const decryptObject = async (obj: any): Promise<any> => {
  if (typeof obj === 'string') {
    try {
      return await decryptValue(obj);
    } catch (e) {
      return obj;
    }
  }
  
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      return Promise.all(obj.map(decryptObject));
    }
    
    const result: any = {};
    for (const key in obj) {
      result[key] = await decryptObject(obj[key]);
    }
    return result;
  }
  
  return obj;
};