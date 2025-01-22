import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { PaymentInfo, UserCredentials, DeliveryInfo, CardInfo } from '../../common/interfaces/types';
import countryCodeData from '../../assets/countryCode.json';
import './PaymentInfoManager.css';
import { Toast } from './Toast';

interface PaymentInfoManagerProps {
  selectedAccount?: string;
}

interface CountryData {
  Zones: Array<{
    code: string;
    name: string;
  }>;
}

const defaultDeliveryInfo: DeliveryInfo = {
  firstName: '',
  lastName: '',
  company: '',
  address1: '',
  address2: '',
  city: '',
  province: '',
  countryCode: 'US',
  postalCode: '',
  phone: ''
};

const defaultCardInfo: CardInfo = {
  number: '',
  expiry: '',
  cvv: '',
  holderName: ''
};

const defaultPaymentInfo: PaymentInfo = {
  accountId: '',
  delivery: defaultDeliveryInfo,
  paymentMethod: 'credit-card',
  card: defaultCardInfo,
  useSameAddress: true,
  billingAddress: defaultDeliveryInfo
};

const formatCardNumber = (value: string): string => {
  // 移除所有非数字字符
  const numbers = value.replace(/\D/g, '');
  // 每4位添加空格
  return numbers.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
};

const formatExpiry = (value: string): string => {
  // 移除所有非数字字符
  const numbers = value.replace(/\D/g, '');
  if (numbers.length >= 2) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}`;
  }
  return numbers;
};

export const PaymentInfoManager: React.FC<PaymentInfoManagerProps> = ({ selectedAccount: initialAccount }) => {
  const [selectedAccount, setSelectedAccount] = useState<string>(initialAccount || '');
  const [accounts, setAccounts] = useState<UserCredentials[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>(defaultPaymentInfo);
  const [countryData, setCountryData] = useState<CountryData>(countryCodeData);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    show: false,
    message: '',
    type: 'info'
  });

  useEffect(() => {
    loadAccounts();
    ipcRenderer.on('select-account', (_, username: string) => {
      setSelectedAccount(username);
      loadPaymentInfo(username);
    });

    return () => {
      ipcRenderer.removeAllListeners('select-account');
    };
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      loadPaymentInfo(selectedAccount);
    }
  }, [selectedAccount]);

  const loadAccounts = async () => {
    try {
      const loadedAccounts = await ipcRenderer.invoke('get-accounts');
      setAccounts(loadedAccounts);
    } catch (error) {
      console.error('加载账号失败:', error);
    }
  };

  const loadPaymentInfo = async (username: string) => {
    try {
      const info = await ipcRenderer.invoke('get-payment-info', username);
      if (info) {
        setPaymentInfo(info);
      } else {
        setPaymentInfo({ ...defaultPaymentInfo, accountId: username });
      }
    } catch (error) {
      console.error('加载支付信息失败:', error);
    }
  };

  const handleAccountChange = async (username: string) => {
    setSelectedAccount(username);
    await loadPaymentInfo(username);
  };

  const handleDeliveryInfoChange = (field: keyof DeliveryInfo, value: string) => {
    setPaymentInfo(prev => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        [field]: value
      }
    }));
  };

  const handleCardInfoChange = (field: keyof CardInfo, value: string) => {
    let formattedValue = value;

    if (field === 'number') {
      formattedValue = formatCardNumber(value);
    } else if (field === 'expiry') {
      formattedValue = formatExpiry(value);
    } else if (field === 'cvv') {
      formattedValue = value.replace(/\D/g, '').slice(0, 4);
    }

    setPaymentInfo(prev => ({
      ...prev,
      card: {
        ...(prev.card || defaultCardInfo),
        [field]: formattedValue
      }
    }));
  };

  const handleBillingAddressChange = (field: keyof DeliveryInfo, value: string) => {
    setPaymentInfo(prev => ({
      ...prev,
      billingAddress: {
        ...(prev.billingAddress || defaultDeliveryInfo),
        [field]: value
      }
    }));
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ show: true, message, type });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) {
      showToast('请选择账号', 'error');
      return;
    }

    const requiredFields: (keyof DeliveryInfo)[] = [
      'firstName',
      'lastName',
      'address1',
      'city',
      'countryCode',
      'postalCode',
      'phone'
    ];

    const missingFields = requiredFields.filter(field => !paymentInfo.delivery[field]);
    if (missingFields.length > 0) {
      showToast(`请填写以下必需字段: ${missingFields.join(', ')}`, 'error');
      return;
    }

    try {
      await ipcRenderer.invoke('save-payment-info', selectedAccount, paymentInfo);
      showToast('支付信息保存成功', 'success');
    } catch (error) {
      console.error('保存支付信息失败:', error);
      showToast('保存支付信息失败', 'error');
    }
  };

  return (
    <div className="payment-info-manager">
      <h2>支付信息管理</h2>

      <div className="account-selector">
        <label>选择账号：</label>
        <select
          value={selectedAccount}
          onChange={(e) => handleAccountChange(e.target.value)}
        >
          <option value="">请选择账号</option>
          {accounts.map(account => (
            <option key={account.username} value={account.username}>
              {account.username}
            </option>
          ))}
        </select>
      </div>

      {selectedAccount && (
        <form onSubmit={handleSubmit}>
          <div className="delivery-info">
            <h3>配送信息</h3>

            <div className="form-group">
              <label className="required-label">国家/地区</label>
              <select
                value={paymentInfo.delivery.countryCode}
                onChange={(e) => handleDeliveryInfoChange('countryCode', e.target.value)}
                required
              >
                <option value="">请选择国家/地区</option>
                {countryData.Zones.map((zone: { code: string; name: string }) => (
                  <option key={zone.code} value={zone.code}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="name-group">
              <div className="form-group">
                <label className="required-label">名字</label>
                <input
                  type="text"
                  value={paymentInfo.delivery.firstName}
                  onChange={(e) => handleDeliveryInfoChange('firstName', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="required-label">姓氏</label>
                <input
                  type="text"
                  value={paymentInfo.delivery.lastName}
                  onChange={(e) => handleDeliveryInfoChange('lastName', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="optional-label">公司名称</label>
              <input
                type="text"
                value={paymentInfo.delivery.company || ''}
                onChange={(e) => handleDeliveryInfoChange('company', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="required-label">地址(address1)</label>
              <input
                type="text"
                value={paymentInfo.delivery.address1}
                onChange={(e) => handleDeliveryInfoChange('address1', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="optional-label">公寓、门牌号等(address2)</label>
              <input
                type="text"
                value={paymentInfo.delivery.address2 || ''}
                onChange={(e) => handleDeliveryInfoChange('address2', e.target.value)}
              />
            </div>

            <div className="address-details">
              <div className="form-group">
                <label className="required-label">城市</label>
                <input
                  type="text"
                  value={paymentInfo.delivery.city}
                  onChange={(e) => handleDeliveryInfoChange('city', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="required-label">省份</label>
                <input
                  type="text"
                  value={paymentInfo.delivery.province || ''}
                  onChange={(e) => handleDeliveryInfoChange('province', e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="required-label">邮编</label>
                <input
                  type="text"
                  value={paymentInfo.delivery.postalCode}
                  onChange={(e) => handleDeliveryInfoChange('postalCode', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="required-label">电话</label>
              <input
                type="tel"
                value={paymentInfo.delivery.phone}
                onChange={(e) => handleDeliveryInfoChange('phone', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="card-info">
            <h3>信用卡信息</h3>

            <div className="form-group">
              <label>卡号</label>
              <input
                type="text"
                value={paymentInfo.card?.number || ''}
                onChange={(e) => handleCardInfoChange('number', e.target.value)}
                placeholder="XXXX XXXX XXXX XXXX"
                maxLength={19}
                required
              />
            </div>

            <div className="expiry-cvv-group">
              <div className="form-group">
                <label>有效期 (MM/YY)</label>
                <input
                  type="text"
                  value={paymentInfo.card?.expiry || ''}
                  onChange={(e) => handleCardInfoChange('expiry', e.target.value)}
                  placeholder="MM/YY"
                  maxLength={5}
                  required
                />
              </div>

              <div className="form-group">
                <label>CVV</label>
                <input
                  type="password"
                  value={paymentInfo.card?.cvv || ''}
                  onChange={(e) => handleCardInfoChange('cvv', e.target.value)}
                  placeholder="XXX"
                  maxLength={4}
                  required
                />
              </div>

              <div className="form-group">
                <label>持卡人姓名</label>
                <input
                  type="text"
                  value={paymentInfo.card?.holderName || ''}
                  onChange={(e) => handleCardInfoChange('holderName', e.target.value)}
                  placeholder="请输入持卡人姓名"
                  required
                />
              </div>
            </div>
          </div>



          <div className="billing-address">
            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={paymentInfo.useSameAddress}
                  onChange={(e) => setPaymentInfo(prev => ({
                    ...prev,
                    useSameAddress: e.target.checked,
                    billingAddress: e.target.checked ? prev.delivery : prev.billingAddress
                  }))}
                />
                使用配送地址作为账单地址
              </label>
            </div>

            {!paymentInfo.useSameAddress && (
              <div className="billing-address-form">
                <h3>账单地址</h3>

                <div className="form-group">
                  <label>国家/地区</label>
                  <select
                    value={paymentInfo.billingAddress?.countryCode || ''}
                    onChange={(e) => handleBillingAddressChange('countryCode', e.target.value)}
                    required
                  >
                    <option value="">请选择国家/地区</option>
                    {countryData.Zones.map((zone: { code: string; name: string }) => (
                      <option key={zone.code} value={zone.code}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>名字</label>
                  <input
                    type="text"
                    value={paymentInfo.billingAddress?.firstName || ''}
                    onChange={(e) => handleBillingAddressChange('firstName', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>姓氏</label>
                  <input
                    type="text"
                    value={paymentInfo.billingAddress?.lastName || ''}
                    onChange={(e) => handleBillingAddressChange('lastName', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>公司名称 (选填)</label>
                  <input
                    type="text"
                    value={paymentInfo.billingAddress?.company || ''}
                    onChange={(e) => handleBillingAddressChange('company', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>详细地址</label>
                  <input
                    type="text"
                    value={paymentInfo.billingAddress?.address1 || ''}
                    onChange={(e) => handleBillingAddressChange('address1', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>门牌号</label>
                  <input
                    type="text"
                    value={paymentInfo.billingAddress?.address2 || ''}
                    onChange={(e) => handleBillingAddressChange('address2', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>城市</label>
                  <input
                    type="text"
                    value={paymentInfo.billingAddress?.city || ''}
                    onChange={(e) => handleBillingAddressChange('city', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>省份</label>
                  <input
                    type="text"
                    value={paymentInfo.billingAddress?.province || ''}
                    onChange={(e) => handleBillingAddressChange('province', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>邮编</label>
                  <input
                    type="text"
                    value={paymentInfo.billingAddress?.postalCode || ''}
                    onChange={(e) => handleBillingAddressChange('postalCode', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>电话</label>
                  <input
                    type="text"
                    value={paymentInfo.billingAddress?.phone || ''}
                    onChange={(e) => handleBillingAddressChange('phone', e.target.value)}
                    required
                  />
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="save-button">
            保存支付信息
          </button>
        </form>
      )}

      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, show: false }))}
        />
      )}
    </div>
  );
};