interface DelayConfig {
  min: number;
  max: number;
}

export class UserBehaviorSimulator {
  private readonly clickDelay: DelayConfig = { min: 50, max: 150 };
  private readonly typeDelay: DelayConfig = { min: 100, max: 300 };
  private readonly pageLoadDelay: DelayConfig = { min: 1000, max: 3000 };

  public async simulateClick(page: any, selector: string): Promise<void> {
    await this.randomDelay(this.clickDelay);
    
    // 模拟鼠标移动
    const element = await page.$(selector);
    const box = await element.boundingBox();
    
    await page.mouse.move(
      box.x + box.width * Math.random(),
      box.y + box.height * Math.random(),
      { steps: 10 }
    );
    
    await this.randomDelay({ min: 50, max: 150 });
    await page.click(selector);
  }

  public async simulateTyping(page: any, selector: string, text: string): Promise<void> {
    await this.randomDelay(this.typeDelay);
    
    for (const char of text) {
      await page.type(selector, char, {
        delay: Math.random() * 100 + 50
      });
    }
  }

  public async simulatePageLoad(): Promise<void> {
    await this.randomDelay(this.pageLoadDelay);
  }

  private async randomDelay(config: DelayConfig): Promise<void> {
    const delay = Math.random() * (config.max - config.min) + config.min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
} 