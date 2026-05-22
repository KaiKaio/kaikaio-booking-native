import forge from 'node-forge';

let cachedPublicKey: forge.pki.rsa.PublicKey | null = null;

export const setPublicKey = (publicKeyPem: string): boolean => {
  try {
    cachedPublicKey = forge.pki.publicKeyFromPem(publicKeyPem);
    return true;
  } catch (error) {
    console.error('解析公钥失败:', error);
    cachedPublicKey = null;
    return false;
  }
};

export const encryptWithOAEP = (plaintext: string): string | null => {
  if (!cachedPublicKey) {
    console.error('公钥未设置');
    return null;
  }

  try {
    const encrypted = cachedPublicKey.encrypt(plaintext, 'RSA-OAEP');
    return forge.util.encode64(encrypted);
  } catch (error) {
    console.error('OAEP 加密失败:', error);
    return null;
  }
};

export const isPublicKeyReady = (): boolean => {
  return cachedPublicKey !== null;
};

export const clearPublicKey = (): void => {
  cachedPublicKey = null;
};
