import { useState, useRef } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Custom Hook để xử lý Firebase Phone Authentication
 * Gửi OTP thật qua SMS và xác thực người dùng
 */
export function useFirebasePhone() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Lưu trữ confirmationResult từ Firebase
  const confirmationResultRef = useRef(null);

  // Lưu trữ RecaptchaVerifier instance
  const recaptchaVerifierRef = useRef(null);

  /**
   * Khởi tạo Invisible reCAPTCHA để xác thực không làm phiền người dùng
   * @param {string} containerId - ID của div container để render reCAPTCHA
   */
  const initializeRecaptcha = (containerId = 'recaptcha-container') => {
    // Nếu đã có instance, không tạo lại
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    try {
      // Tạo Invisible reCAPTCHA Verifier
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible', // Không hiển thị reCAPTCHA box
        callback: () => {
          // reCAPTCHA solved - cho phép gửi SMS
          console.log('reCAPTCHA verified successfully');
        },
        'expired-callback': () => {
          // reCAPTCHA hết hạn - cần làm mới
          console.warn('reCAPTCHA expired, please try again');
          setError('Phiên xác thực hết hạn. Vui lòng thử lại.');
        }
      });

      return recaptchaVerifierRef.current;
    } catch (err) {
      console.error('Error initializing reCAPTCHA:', err);
      setError('Không thể khởi tạo reCAPTCHA. Vui lòng tải lại trang.');
      return null;
    }
  };

  /**
   * Gửi mã OTP THẬT qua SMS đến số điện thoại
   * @param {string} phoneNumber - Số điện thoại có mã quốc gia (vd: +84987654321)
   * @returns {Promise<object>} - Trả về object chứa verificationId
   */
  const sendOTP = async (phoneNumber) => {
    setLoading(true);
    setError(null);

    try {
      // Xác thực định dạng số điện thoại (phải có mã quốc gia)
      if (!phoneNumber.startsWith('+')) {
        throw new Error('Số điện thoại phải bắt đầu bằng mã quốc gia (ví dụ: +84)');
      }

      // Khởi tạo reCAPTCHA
      const recaptchaVerifier = initializeRecaptcha();
      if (!recaptchaVerifier) {
        throw new Error('Không thể khởi tạo reCAPTCHA');
      }

      // Gửi yêu cầu OTP qua Firebase (SMS THẬT sẽ được gửi)
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        phoneNumber,
        recaptchaVerifier
      );

      // Lưu confirmationResult để dùng khi verify OTP
      confirmationResultRef.current = confirmationResult;

      console.log('OTP sent successfully to:', phoneNumber);

      setLoading(false);
      return {
        success: true,
        verificationId: confirmationResult.verificationId,
        message: 'Mã OTP đã được gửi đến số điện thoại của bạn'
      };

    } catch (err) {
      console.error('Error sending OTP:', err);
      setLoading(false);

      // Xử lý các lỗi phổ biến từ Firebase
      let errorMessage = 'Không thể gửi mã OTP. Vui lòng thử lại.';

      if (err.code === 'auth/invalid-phone-number') {
        errorMessage = 'Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.';
      } else if (err.code === 'auth/quota-exceeded') {
        errorMessage = 'Hệ thống đã vượt quá giới hạn gửi tin nhắn. Vui lòng liên hệ quản trị viên.';
      } else if (err.code === 'auth/captcha-check-failed') {
        errorMessage = 'Xác thực reCAPTCHA thất bại. Vui lòng thử lại.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  /**
   * Xác thực mã OTP mà người dùng nhập vào
   * @param {string} otpCode - Mã OTP 6 số người dùng nhận qua SMS
   * @returns {Promise<object>} - Trả về Firebase User object và idToken
   */
  const verifyOTP = async (otpCode) => {
    setLoading(true);
    setError(null);

    try {
      // Kiểm tra xem đã gửi OTP chưa
      if (!confirmationResultRef.current) {
        throw new Error('Vui lòng gửi mã OTP trước khi xác thực');
      }

      // Xác thực định dạng OTP (6 số)
      if (!/^\d{6}$/.test(otpCode)) {
        throw new Error('Mã OTP phải là 6 chữ số');
      }

      // Xác thực mã OTP với Firebase
      const userCredential = await confirmationResultRef.current.confirm(otpCode);

      // Lấy Firebase User object
      const user = userCredential.user;

      // Lấy ID Token để gửi lên backend
      const idToken = await user.getIdToken();

      console.log('OTP verified successfully for user:', user.uid);

      setLoading(false);
      return {
        success: true,
        user: {
          uid: user.uid,
          phoneNumber: user.phoneNumber,
          idToken: idToken
        }
      };

    } catch (err) {
      console.error('Error verifying OTP:', err);
      setLoading(false);

      // Xử lý lỗi xác thực OTP
      let errorMessage = 'Xác thực mã OTP thất bại. Vui lòng thử lại.';

      if (err.code === 'auth/invalid-verification-code') {
        errorMessage = 'Mã OTP không đúng. Vui lòng kiểm tra lại.';
      } else if (err.code === 'auth/code-expired') {
        errorMessage = 'Mã OTP đã hết hạn. Vui lòng gửi lại mã mới.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  /**
   * Reset trạng thái và xóa reCAPTCHA
   */
  const resetState = () => {
    confirmationResultRef.current = null;

    // Xóa reCAPTCHA verifier
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (err) {
        console.warn('Error clearing reCAPTCHA:', err);
      }
      recaptchaVerifierRef.current = null;
    }

    setError(null);
    setLoading(false);
  };

  return {
    sendOTP,
    verifyOTP,
    resetState,
    loading,
    error
  };
}
