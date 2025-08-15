import Toast from 'react-native-toast-message';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export const showToast = (
  type: ToastType,
  text1: string,
  text2?: string,
  duration?: number
) => {
  Toast.show({
    type,
    text1,
    text2,
    visibilityTime: duration || (type === 'error' ? 5000 : 3000),
    autoHide: true,
    topOffset: 60,
  });
};

export const hideToast = () => {
  Toast.hide();
};