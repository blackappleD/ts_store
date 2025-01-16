import React from 'react';
import { PurchaseStrategy as PurchaseStrategyType } from '../../common/interfaces/types';

interface PurchaseStrategyProps {
  strategy: PurchaseStrategyType;
  onChange: (key: keyof PurchaseStrategyType, value: any) => void;
}

export const PurchaseStrategy: React.FC<PurchaseStrategyProps> = ({ strategy, onChange }) => {
  return (
    <div className="purchase-strategy">
      <h3>购买策略设置</h3>
      
      <div className="strategy-item">
        <label>
          <input
            type="checkbox"
            checked={strategy.autoPurchase}
            onChange={(e) => onChange('autoPurchase', e.target.checked)}
          />
          自动购买
        </label>
      </div>

      <div className="strategy-item">
        <label>
          <input
            type="checkbox"
            checked={strategy.multiAccount}
            onChange={(e) => onChange('multiAccount', e.target.checked)}
          />
          多账号抢购
        </label>
      </div>

      <div className="strategy-item">
        <label>
          <input
            type="checkbox"
            checked={strategy.priceLimit}
            onChange={(e) => onChange('priceLimit', e.target.checked)}
          />
          启用价格限制
        </label>
      </div>

      {strategy.priceLimit && (
        <div className="strategy-item">
          <label>
            最高价格：
            <input
              type="number"
              value={strategy.maxPrice || 0}
              onChange={(e) => onChange('maxPrice', parseFloat(e.target.value))}
              min={0}
              step={0.01}
            />
          </label>
        </div>
      )}

      {strategy.multiAccount && (
        <div className="purchase-limits">
          <div className="strategy-item">
            <label>
              单账号下单量：
              <input
                type="number"
                value={strategy.purchaseLimit?.singleAccountLimit || 1}
                onChange={(e) => onChange('purchaseLimit', {
                  ...strategy.purchaseLimit,
                  singleAccountLimit: parseInt(e.target.value)
                })}
                min={1}
              />
            </label>
          </div>

          <div className="strategy-item">
            <label>
              每单购买数量：
              <input
                type="number"
                value={strategy.purchaseLimit?.quantityPerOrder || 1}
                onChange={(e) => onChange('purchaseLimit', {
                  ...strategy.purchaseLimit,
                  quantityPerOrder: parseInt(e.target.value)
                })}
                min={1}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}; 