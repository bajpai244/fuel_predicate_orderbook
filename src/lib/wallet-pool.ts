import { Provider, WalletUnlocked } from 'fuels';
import type { FuelWallet } from '../types';

interface WalletWithLock {
  wallet: FuelWallet;
  isLocked: boolean;
  unlockTime: number | null;
}

export class WalletPool {
  private wallets: WalletWithLock[];
  private currentIndex: number;
  private readonly lockDuration: number;

  constructor(
    privateKeys: string[],
    provider: Provider,
    lockDuration: number = 10000
  ) {
    this.wallets = privateKeys.map((privateKey) => ({
      wallet: new WalletUnlocked(privateKey, provider),
      isLocked: false,
      unlockTime: null,
    }));
    this.currentIndex = 0;
    this.lockDuration = lockDuration;
  }

  private async getNextAvailableWallet(): Promise<WalletWithLock | null> {
    const startIndex = this.currentIndex;

    do {
      const wallet = this.wallets[this.currentIndex];

      // Check if wallet is locked
      if (!wallet.isLocked) {
        return wallet;
      }

      // Check if lock has expired
      if (wallet.unlockTime && Date.now() >= wallet.unlockTime) {
        wallet.isLocked = false;
        wallet.unlockTime = null;
        return wallet;
      }

      // Move to next wallet
      this.currentIndex = (this.currentIndex + 1) % this.wallets.length;
    } while (this.currentIndex !== startIndex);

    return null;
  }

  public async getWallet(): Promise<FuelWallet | null> {
    const walletWithLock = await this.getNextAvailableWallet();

    if (!walletWithLock) {
      return null;
    }

    // Lock the wallet
    walletWithLock.isLocked = true;
    walletWithLock.unlockTime = Date.now() + this.lockDuration;

    // Schedule auto-unlock
    setTimeout(() => {
      walletWithLock.isLocked = false;
      walletWithLock.unlockTime = null;
    }, this.lockDuration);

    return walletWithLock.wallet;
  }

  public getWalletCount(): number {
    return this.wallets.length;
  }
}
