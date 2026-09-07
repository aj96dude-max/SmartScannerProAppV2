import RNFS from 'react-native-fs';

export const StorageEngine = {
  /**
   * Initializes the hidden temp directory for non-destructive storage.
   */
  async init(): Promise<void> {
    const hiddenDirPath = `${RNFS.DocumentDirectoryPath}/.smartscanner_raw`;
    const exists = await RNFS.exists(hiddenDirPath);
    if (!exists) {
      await RNFS.mkdir(hiddenDirPath);
    }
  },

  /**
   * Generates an automated taxonomy filename.
   * Format: Doc_YYYYMMDD_HHMMSS.jpg
   */
  generateTaxonomyName(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `Doc_${yyyy}${mm}${dd}_${hh}${min}${ss}.jpg`;
  },

  /**
   * Safely moves the raw capture from the volatile cache to our hidden storage.
   * Ensures we never overwrite original raw data.
   * @param cachePath The temporary path provided by VisionCamera or ImagePicker
   * @returns The new permanent safe path
   */
  async preserveRawCapture(cachePath: string): Promise<string> {
    await this.init();
    
    // Normalize path just in case
    let safeCachePath = cachePath;
    if (safeCachePath.startsWith('file://')) {
      safeCachePath = safeCachePath.replace('file://', '');
    }

    const taxonomyName = this.generateTaxonomyName();
    const safePath = `${RNFS.DocumentDirectoryPath}/.smartscanner_raw/${taxonomyName}`;

    await RNFS.copyFile(safeCachePath, safePath);
    return safePath;
  }
};
