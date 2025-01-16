# Taylor Swift CD 抢购工具设计文档

## 1. 技术栈选择

- Electron: 实现跨平台桌面应用
- React: 用户界面开发
- TypeScript: 确保代码类型安全
- Axios: 网络请求处理
- Puppeteer: 模拟浏览器行为

## 2. 系统架构

系统主要分为以下模块：

- 主程序 (Main Process)
  - 商品监控模块
  - 抢购任务模块
  - 用户界面 (Renderer Process)

- 商品监控模块
  - 商品价格监控
  - 库存状态检查

- 抢购任务模块
  - 登录认证
  - 下单流程
  - 支付处理

- 用户界面模块
  - 任务配置
  - 状态展示
  - 通知提醒

## 3. 核心接口设计

```typescript
// 商品监控接口
interface ProductMonitor {
  url: string;
  checkInterval: number; // 检查间隔（毫秒）
  onAvailable: (product: Product) => void;
  
  startMonitoring(): void;
  stopMonitoring(): void;
}

// 抢购任务接口
interface PurchaseTask {
  product: Product;
  userCredentials: UserCredentials;
  paymentInfo: PaymentInfo;
  
  execute(): Promise<PurchaseResult>;
}

// 配置信息接口
interface Config {
  targetUrl: string;
  refreshInterval: number;
  autoRetry: boolean;
  maxRetries: number;
  notificationEnabled: boolean;
}
```

## 4. 商品监控实现

```typescript
class ProductMonitorImpl implements ProductMonitor {
  private timer: NodeJS.Timer | null = null;
  
  async checkAvailability(): Promise<boolean> {
    try {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.goto(this.url);
      
      const available = await page.evaluate(() => {
        const button = document.querySelector('.add-to-cart');
        return button && !button.disabled;
      });
      
      await browser.close();
      return available;
    } catch (error) {
      console.error('检查可用性失败:', error);
      return false;
    }
  }
  
  startMonitoring(): void {
    this.timer = setInterval(async () => {
      const available = await this.checkAvailability();
      if (available) {
        this.onAvailable(this.product);
      }
    }, this.checkInterval);
  }
}
```

## 5. 安全性考虑

1. 请求保护：
   - 实现请求延迟和随机间隔
   - 使用代理IP池轮换
   - 模拟真实用户行为
   - 添加随机等待时间

2. 数据安全：
   - 用户凭证加密存储
   - 支付信息安全处理
   - 本地数据保护

## 6. 优化建议

1. 功能优化：
   - 多账号同时抢购
   - 商品价格监控
   - 自定义抢购规则
   - 抢购成功率统计
   - 失败自动重试
   - 声音/手机通知

2. 性能优化：
   - 内存使用优化
   - 网络请求优化
   - UI响应优化

## 7. 使用注意事项

1. 遵守网站使用条款和规则
2. 合理设置刷新间隔
3. 确保支付信息安全
4. 注意网站反爬虫机制

## 8. 界面预览

用户界面包含以下主要功能：
- 目标商品URL配置
- 刷新间隔设置
- 自动重试开关
- 通知提醒设置
- 监控状态显示
- 开始/停止控制

## 9. 后续开发计划

1. 第一阶段：
   - 基础监控功能
   - 简单用户界面
   - 基本抢购流程

2. 第二阶段：
   - 多账号管理
   - 高级抢购策略
   - 通知系统完善

3. 第三阶段：
   - 性能优化
   - 安全性增强
   - 用户体验改进

## 9. 程序可打包成多平台运行的
包括：Windows, MacOS



优化：
1. 在监控商品页面，添加一个多账户抢购选项，当勾选了多账号抢购时，开始监控前需要检验所有账号是否都已经配置了支付信息，如果有账号未配置，需要提示："多账号抢购需要为每个账号配置支付信息，xxxx/yyyy/zzzz账号未配置"
2. 账号管理页面，给账号添加默认单选项，被选中的账号为默认账号
3. 当商品状态检查结果判断为可购买时，在该商品页面进行登录（不要再额外开启浏览器页面）并随机选取账号进行登录（如果未勾选多账号抢购，则使用默认账号进行登录）并跳转到购买支付的页面，并自动填充我们未该账号提前配置好的支付信息
4. 在监控商品页面，添加一个是否自动完成购买选项：勾选该选项时，会自动完成购买流程，如果未勾选，则需要在的支付页面手动点击支付按钮

优化：
一。支付信息页面
1. 在账号管理页面为每个账号添加一个按钮：如果该账号已经配置了支付信息，那么按钮显示为：编辑支付信息，反之显示为：添加支付信息
2. 配送信息-国家/地区字段的下拉选择从 文件 contryCode.json的Zones字段 中获取,展示name，选取的时候填写code 
二。监控商品页面
1. 在监控商品页面/购买策略中，添加一个是否自动完成购买选项：勾选该选项时，会自动完成购买流程，如果未勾选，则需要在的支付页面手动点击支付按钮
2. 将开始监控按钮挪到基本设置下方

多账号抢购流程：
1. 访问商品页面
2. 添加商品到购物车
3. 在购物车点击GO TO CHECKOU按钮进入支付排队，页面会提示You`re in line to check out
4. 排队结束后跳转到支付信息填写页面，填写准备好的支付信息
5. 点击Pay now按钮完成支付
graph TD
    A[开始] --> B[打开商品页面]
    B --> C{是否有库存?}
    C -- 是 --> D[添加商品到购物车]
    C -- 否 --> B
    D --> E[进入购物车页面]
    E --> F[点击GO TO CHECKOUT按钮]
    F --> G{是否进入排队?}
    G -- 是 --> H[等待排队结束]
    G -- 否 --> B
    H --> I[进入支付信息填写页面]
    I --> J[填写支付信息]
    J --> K[点击Pay now按钮]
    K --> L{支付成功?}
    L -- 是 --> M[结束]
    L -- 否 --> B

2025.1.16
1. 账号管理页面，添加两个参数：单账号下单量，每单购买数量
2. 添加商品到购物车时，需要从账号池中随机选取账号下单量未达到上限的账号，并根据每单购买数量来添加商品到购物车
3. 进入支付信息填写页面时，自动填写该账号的邮箱，及关联的其他支付信息
