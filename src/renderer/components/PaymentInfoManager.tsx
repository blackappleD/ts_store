import React, { useState, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { UserCredentials, Zone, CountryData } from '../../common/interfaces/types';
import countryData from '../../assets/countryCode.json';

interface DeliveryInfo {
  country: string;
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
}

interface PaymentInfo {
  accountId: string;
  delivery: DeliveryInfo;
  paymentMethod: 'credit-card' | 'alipay' | 'wechat-pay';
  creditCard?: {
    number: string;
    holder: string;
    expMonth: string;
    expYear: string;
    cvv: string;
  };
}

const zones = (countryData as CountryData).Zones;

interface PaymentInfoManagerProps {
  selectedAccount: string | null;
}

export const PaymentInfoManager: React.FC<PaymentInfoManagerProps> = ({ selectedAccount }) => {
  const [accounts, setAccounts] = useState<UserCredentials[]>([]);
  const [currentAccount, setCurrentAccount] = useState<string>('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    accountId: '',
    delivery: {
      country: 'CN',
      firstName: '',
      lastName: '',
      company: '',
      address1: '',
      address2: '',
      city: '',
      province: '',
      postalCode: '',
      phone: ''
    },
    paymentMethod: 'credit-card'
  });

  const loadPaymentInfo = async (username: string) => {
    try {
      const savedInfo = await ipcRenderer.invoke('get-payment-info', username);
      if (savedInfo) {
        setPaymentInfo(savedInfo);
        setCurrentAccount(username);
      } else {
        setPaymentInfo(prev => ({
          ...prev,
          accountId: username
        }));
        setCurrentAccount(username);
      }
    } catch (error) {
      console.error('加载支付信息失败:', error);
    }
  };

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const savedAccounts = await ipcRenderer.invoke('get-accounts');
        setAccounts(savedAccounts);
        
        if (selectedAccount) {
          await loadPaymentInfo(selectedAccount);
        }
      } catch (error) {
        console.error('加载账号失败:', error);
      }
    };
    loadAccounts();
  }, [selectedAccount]);

  useEffect(() => {
    if (currentAccount) {
      loadPaymentInfo(currentAccount);
    }
  }, [currentAccount]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    
    if (!currentAccount) {
      newErrors.account = '请选择账号';
    }
    if (!paymentInfo.delivery.country.trim()) {
      newErrors.country = '请选择国家/地区';
    }
    if (!paymentInfo.delivery.firstName.trim()) {
      newErrors.firstName = '请输入名字';
    }
    if (!paymentInfo.delivery.lastName.trim()) {
      newErrors.lastName = '请输入姓氏';
    }
    if (!paymentInfo.delivery.address1.trim()) {
      newErrors.address1 = '请输入详细地址';
    }
    if (!paymentInfo.delivery.city.trim()) {
      newErrors.city = '请输入城市';
    }
    if (!paymentInfo.delivery.province.trim()) {
      newErrors.province = '请选择省份';
    }
    if (!paymentInfo.delivery.postalCode.trim()) {
      newErrors.postalCode = '请输入邮政编码';
    }
    if (!paymentInfo.delivery.phone.trim()) {
      newErrors.phone = '请输入电话号码';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDeliveryChange = (field: keyof DeliveryInfo, value: string) => {
    setPaymentInfo(prev => ({
      ...prev,
      delivery: {
        ...prev.delivery,
        [field]: value
      }
    }));
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const infoToSave = {
        ...paymentInfo,
        accountId: currentAccount
      };
      await ipcRenderer.invoke('save-payment-info', infoToSave);
      
      const updatedAccounts = accounts.map(acc => ({
        ...acc,
        hasPaymentInfo: acc.username === currentAccount ? true : acc.hasPaymentInfo
      }));
      setAccounts(updatedAccounts);
      
      alert('保存成功');
      setErrors({});
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败');
    }
  };

  return (
    <div className="payment-info">
      <h3>配送与支付信息</h3>
      
      <div className="payment-form">
        <div className="form-group">
          <label>选择账号 <span className="required">*</span></label>
          <select
            value={currentAccount}
            onChange={(e) => setCurrentAccount(e.target.value)}
            className={errors.account ? 'error' : ''}
          >
            <option value="">请选择账号</option>
            {accounts.map(account => (
              <option key={account.username} value={account.username}>
                {account.username}
              </option>
            ))}
          </select>
          {errors.account && <div className="error-message">{errors.account}</div>}
        </div>

        <div className="delivery-info">
          <h4>配送信息</h4>
          
          <div className="form-group">
            <label>国家/地区 <span className="required">*</span></label>
            <select
              value={paymentInfo.delivery.country}
              onChange={(e) => handleDeliveryChange('country', e.target.value)}
              className={errors.country ? 'error' : ''}
            >
              <option value="">请选择国家/地区</option>
              {zones.map((zone: Zone) => (
                <option key={zone.code} value={zone.code}>
                  {zone.name}
                </option>
              ))}
            </select>
            {errors.country && <div className="error-message">{errors.country}</div>}
          </div>

          <div className="name-group">
            <div className="form-group">
              <label>名 <span className="required">*</span></label>
              <input
                type="text"
                value={paymentInfo.delivery.firstName}
                onChange={(e) => handleDeliveryChange('firstName', e.target.value)}
                className={errors.firstName ? 'error' : ''}
                placeholder="First name"
              />
              {errors.firstName && <div className="error-message">{errors.firstName}</div>}
            </div>
            
            <div className="form-group">
              <label>姓 <span className="required">*</span></label>
              <input
                type="text"
                value={paymentInfo.delivery.lastName}
                onChange={(e) => handleDeliveryChange('lastName', e.target.value)}
                className={errors.lastName ? 'error' : ''}
                placeholder="Last name"
              />
              {errors.lastName && <div className="error-message">{errors.lastName}</div>}
            </div>
          </div>

          <div className="form-group">
            <label>公司（选填）</label>
            <input
              type="text"
              value={paymentInfo.delivery.company}
              onChange={(e) => handleDeliveryChange('company', e.target.value)}
              placeholder="Company name (optional)"
            />
          </div>

          <div className="form-group">
            <label>详细地址 <span className="required">*</span></label>
            <input
              type="text"
              value={paymentInfo.delivery.address1}
              onChange={(e) => handleDeliveryChange('address1', e.target.value)}
              className={errors.address1 ? 'error' : ''}
              placeholder="Address"
            />
            {errors.address1 && <div className="error-message">{errors.address1}</div>}
          </div>

          <div className="form-group">
            <label>门牌号（选填）</label>
            <input
              type="text"
              value={paymentInfo.delivery.address2}
              onChange={(e) => handleDeliveryChange('address2', e.target.value)}
              placeholder="Apartment, suite, etc. (optional)"
            />
          </div>

          <div className="location-group">
            <div className="form-group">
              <label>城市 <span className="required">*</span></label>
              <input
                type="text"
                value={paymentInfo.delivery.city}
                onChange={(e) => handleDeliveryChange('city', e.target.value)}
                className={errors.city ? 'error' : ''}
                placeholder="City"
              />
              {errors.city && <div className="error-message">{errors.city}</div>}
            </div>

            <div className="form-group">
              <label>省份 <span className="required">*</span></label>
              <select
                value={paymentInfo.delivery.province}
                onChange={(e) => handleDeliveryChange('province', e.target.value)}
                className={errors.province ? 'error' : ''}
              >
                <option value="">请选择省份</option>
                <option value="Beijing">北京市</option>
                <option value="Shanghai">上海市</option>
                <option value="Guangdong">广东省</option>
                {/* 添加其他省份 */}
              </select>
              {errors.province && <div className="error-message">{errors.province}</div>}
            </div>

            <div className="form-group">
              <label>邮政编码 <span className="required">*</span></label>
              <input
                type="text"
                value={paymentInfo.delivery.postalCode}
                onChange={(e) => handleDeliveryChange('postalCode', e.target.value)}
                className={errors.postalCode ? 'error' : ''}
                placeholder="Postal code"
              />
              {errors.postalCode && <div className="error-message">{errors.postalCode}</div>}
            </div>
          </div>

          <div className="form-group">
            <label>电话 <span className="required">*</span></label>
            <input
              type="tel"
              value={paymentInfo.delivery.phone}
              onChange={(e) => handleDeliveryChange('phone', e.target.value)}
              className={errors.phone ? 'error' : ''}
              placeholder="+86"
            />
            {errors.phone && <div className="error-message">{errors.phone}</div>}
          </div>
        </div>

        <button 
          className="save-button" 
          onClick={handleSave}
          disabled={Object.keys(errors).length > 0}
        >
          保存信息
        </button>
      </div>
    </div>
  );
};