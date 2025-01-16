import Store from 'electron-store';
import crypto from 'crypto';
import { UserCredentials, PaymentInfo } from '../../common/interfaces/types';

export class CredentialManager {
  private store: Store;
  private readonly ENCRYPTION_KEY: string;
  private readonly IV_LENGTH = 16;
  private readonly SALT_LENGTH = 16;

  constructor() {
    this.store = new Store({ name: 'credentials' });
    // 从环境变量或配置文件获取加密密钥
    this.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-fallback-encryption-key';
  }

  private encrypt(text: string): string {
    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = crypto.scryptSync(this.ENCRYPTION_KEY, salt, 32);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  }

  private decrypt(encryptedText: string): string {
    const buffer = Buffer.from(encryptedText, 'base64');
    
    const salt = buffer.slice(0, this.SALT_LENGTH);
    const iv = buffer.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
    const tag = buffer.slice(this.SALT_LENGTH + this.IV_LENGTH, this.SALT_LENGTH + this.IV_LENGTH + 16);
    const encrypted = buffer.slice(this.SALT_LENGTH + this.IV_LENGTH + 16);
    
    const key = crypto.scryptSync(this.ENCRYPTION_KEY, salt, 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  public saveUserCredentials(username: string, credentials: UserCredentials): void {
    const encrypted = this.encrypt(JSON.stringify(credentials));
    this.store.set(`user.${username}`, encrypted);
  }

  public getUserCredentials(username: string): UserCredentials | null {
    const encrypted = this.store.get(`user.${username}`) as string | undefined;
    if (!encrypted) return null;
    
    try {
      return JSON.parse(this.decrypt(encrypted));
    } catch (error) {
      console.error('Failed to decrypt user credentials:', error);
      return null;
    }
  }

  public savePaymentInfo(username: string, paymentInfo: PaymentInfo): void {
    const encrypted = this.encrypt(JSON.stringify(paymentInfo));
    this.store.set(`payment.${username}`, encrypted);
  }

  public getPaymentInfo(username: string): PaymentInfo | null {
    const encrypted = this.store.get(`payment.${username}`) as string | undefined;
    if (!encrypted) return null;
    
    try {
      return JSON.parse(this.decrypt(encrypted));
    } catch (error) {
      console.error('Failed to decrypt payment info:', error);
      return null;
    }
  }

  public deleteUserData(username: string): void {
    this.store.delete(`user.${username}`);
    this.store.delete(`payment.${username}`);
  }
} 