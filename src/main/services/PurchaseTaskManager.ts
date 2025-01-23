import {Product, UserCredentials, PaymentInfo} from '../../common/interfaces/types';
import {INotificationManager} from './NotificationManager';
import {ProxyManager} from './ProxyManager';
import {PurchaseFlow} from './PurchaseFlow';
import {AccountManagerService} from "./AccountManager";

export class PurchaseTaskManager {
    private purchaseFlow: PurchaseFlow;

    constructor(
        private notificationManager: INotificationManager,
        private proxyManager: ProxyManager
    ) {
        this.purchaseFlow = new PurchaseFlow(notificationManager);
    }

    async startPurchaseTask(
        product: Product,
        account: UserCredentials,
        paymentInfo: PaymentInfo
    ): Promise<boolean> {
        try {
            // 获取购买设置
            const purchaseSettings = await AccountManagerService.getInstance().getPurchaseSettings();
            // 使用购买设置
            const quantity = purchaseSettings.quantityPerOrder;

            return await this.purchaseFlow.execute(product, account, paymentInfo, false, quantity);
        } catch (error) {
            console.error('购买任务执行失败:', error);
            return false;
        }
    }
} 