<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  login,
  loginWithGoogle,
  register,
  requestForgotPasswordOtp,
  resendVerifyEmailOtp,
  resetForgotPassword,
  verifyEmailOtp,
  verifyForgotPasswordOtp,
} from '../../services/api';
import { clearVisitTraderIntent, getVisitTraderIntent, saveSession } from '../../services/session';

const router = useRouter();
const mode = ref('login');
const fullName = ref('');
const email = ref('');
const phone = ref('');
const contactMethod = ref('email');
const loginIdentifier = ref('');
const password = ref('');
const confirmPassword = ref('');
const staffReason = ref('');
const showPassword = ref(false);
const loading = ref(false);
const feedback = ref('');
const isError = ref(false);
const googleButton = ref(null);
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
let googleScript;

const verifyContact = ref('');
const verifyChannel = ref('email');
const verifyOtp = ref('');

const forgotContact = ref('');
const forgotChannel = ref('email');
const forgotOtp = ref('');
const resetToken = ref('');
const forgotNewPassword = ref('');
const forgotConfirmPassword = ref('');

function passwordIsStrong(value) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value);
}

function normalizeOtpInput(value, channel = 'email') {
  const cleaned = String(value || '').replace(/[^a-z0-9]/gi, '');
  return channel === 'phone' ? cleaned.replace(/\D/g, '').slice(0, 6) : cleaned.toUpperCase().slice(0, 8);
}

function contactChannelFor(contact) {
  const value = String(contact || '').trim();
  return value && !value.includes('@') ? 'phone' : 'email';
}

function setFeedback(message, error = false) {
  feedback.value = message;
  isError.value = error;
}

function setMode(nextMode) {
  mode.value = nextMode;
  setFeedback('', false);
}

function isTraderAccount(user) {
  return Boolean(user && (user.role === 'trader' || user.status === 'trader'));
}

function isAdminAccount(user) {
  return Boolean(user && user.role === 'admin');
}

function routeAfterLogin(user) {
  const traderIntentId = getVisitTraderIntent();

  if (traderIntentId && (user.role === 'client' || isTraderAccount(user))) {
    clearVisitTraderIntent();
    return router.push({ name: 'trader-visit-detail', params: { id: String(traderIntentId) } });
  }

  if (traderIntentId) {
    clearVisitTraderIntent();
  }

  if (isAdminAccount(user)) return router.push('/admin');
  if (isTraderAccount(user)) return router.push('/trader/dashboard');
  return router.push('/client');
}

function openVerifyEmailScreen(prefillContact = '', channel = '') {
  const contact = String(prefillContact || loginIdentifier.value || email.value || phone.value || verifyContact.value || '').trim();
  verifyContact.value = contact;
  verifyChannel.value = channel || contactChannelFor(contact);
  verifyOtp.value = '';
  setMode('verify-email');
}

function openForgotPasswordScreen(prefillContact = '') {
  const contact = String(prefillContact || loginIdentifier.value || email.value || '').trim();
  forgotContact.value = contact;
  forgotChannel.value = contactChannelFor(contact);
  forgotOtp.value = '';
  resetToken.value = '';
  forgotNewPassword.value = '';
  forgotConfirmPassword.value = '';
  setMode('forgot-email');
}

async function submitLogin() {
  const result = await login({
    identifier: loginIdentifier.value,
    password: password.value,
  });

  saveSession(result.token, result.user);
  routeAfterLogin(result.user);
}

async function submitGoogleLogin(response) {
  loading.value = true;
  setFeedback('', false);

  try {
    const result = await loginWithGoogle({ credential: response.credential });
    saveSession(result.token, result.user);
    routeAfterLogin(result.user);
  } catch (error) {
    setFeedback(error.message, true);
  } finally {
    loading.value = false;
  }
}

function initializeGoogleButton() {
  if (!googleClientId || !googleButton.value || !window.google?.accounts?.id) {
    return;
  }

  window.google.accounts.id.initialize({
    client_id: googleClientId,
    callback: submitGoogleLogin,
  });
  window.google.accounts.id.renderButton(googleButton.value, {
    theme: 'outline',
    size: 'large',
    width: 360,
    text: 'signin_with',
  });
}

onMounted(() => {
  if (!googleClientId) return;

  if (window.google?.accounts?.id) {
    initializeGoogleButton();
    return;
  }

  googleScript = document.createElement('script');
  googleScript.src = 'https://accounts.google.com/gsi/client';
  googleScript.async = true;
  googleScript.defer = true;
  googleScript.onload = initializeGoogleButton;
  document.head.appendChild(googleScript);
});

onBeforeUnmount(() => {
  if (googleScript?.parentNode) {
    googleScript.parentNode.removeChild(googleScript);
  }
});

async function submitRegister() {
  if (!String(staffReason.value || '').trim()) {
    throw new Error('Please provide your reason for becoming a staff.');
  }

  if (!passwordIsStrong(password.value)) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
  }

  if (password.value !== confirmPassword.value) {
    throw new Error('Password and confirm password do not match.');
  }

  const result = await register({
    fullName: fullName.value,
    email: contactMethod.value === 'email' ? email.value : undefined,
    phone: contactMethod.value === 'phone' ? phone.value : undefined,
    password: password.value,
    staffReason: staffReason.value,
  });
  verifyContact.value = result.contact || (contactMethod.value === 'phone' ? phone.value : email.value);
  verifyChannel.value = result.channel || contactMethod.value;
  verifyOtp.value = '';
  setMode('verify-email');
  setFeedback(
    `Registration complete. Enter the code sent by ${verifyChannel.value === 'phone' ? 'SMS' : 'email'} to verify your ${verifyChannel.value === 'phone' ? 'phone number' : 'email'}.`,
    false
  );
}

async function submitVerifyEmailOtp() {
  const result = await verifyEmailOtp({
    contact: verifyContact.value,
    channel: verifyChannel.value,
    otp: verifyOtp.value,
  });

  saveSession(result.token, result.user);
  routeAfterLogin(result.user);
}

async function resendVerifyOtp() {
  loading.value = true;
  setFeedback('', false);
  try {
    await resendVerifyEmailOtp({ contact: verifyContact.value, channel: verifyChannel.value });
    setFeedback(`A new verification code was sent by ${verifyChannel.value === 'phone' ? 'SMS' : 'email'}.`, false);
  } catch (error) {
    setFeedback(error.message, true);
  } finally {
    loading.value = false;
  }
}

async function resendForgotOtp() {
  loading.value = true;
  setFeedback('', false);
  try {
    await requestForgotPasswordOtp({ contact: forgotContact.value, channel: forgotChannel.value });
    forgotOtp.value = '';
    setFeedback(`A new reset code was sent by ${forgotChannel.value === 'phone' ? 'SMS' : 'email'}.`, false);
  } catch (error) {
    setFeedback(error.message, true);
  } finally {
    loading.value = false;
  }
}

async function submitForgotEmail() {
  await requestForgotPasswordOtp({ contact: forgotContact.value, channel: forgotChannel.value });
  forgotOtp.value = '';
  setMode('forgot-otp');
  setFeedback(`Enter the code sent by ${forgotChannel.value === 'phone' ? 'SMS' : 'email'}.`, false);
}

async function submitForgotOtp() {
  const result = await verifyForgotPasswordOtp({
    contact: forgotContact.value,
    channel: forgotChannel.value,
    otp: forgotOtp.value,
  });

  resetToken.value = result.resetToken;
  forgotNewPassword.value = '';
  forgotConfirmPassword.value = '';
  setMode('forgot-reset');
  setFeedback('OTP verified. You can now create a new password.', false);
}

async function submitForgotResetPassword() {
  if (forgotNewPassword.value !== forgotConfirmPassword.value) {
    throw new Error('Password and confirm password do not match.');
  }

  if (!passwordIsStrong(forgotNewPassword.value)) {
    throw new Error('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
  }

  await resetForgotPassword({
    resetToken: resetToken.value,
    newPassword: forgotNewPassword.value,
    confirmPassword: forgotConfirmPassword.value,
  });

  setMode('login');
  password.value = '';
  confirmPassword.value = '';
  setFeedback('Password reset successful. You can now log in.', false);
}

async function submitForm() {
  loading.value = true;
  setFeedback('', false);

  try {
    if (mode.value === 'register') {
      await submitRegister();
      return;
    }

    if (mode.value === 'login') {
      await submitLogin();
      return;
    }

    if (mode.value === 'verify-email') {
      await submitVerifyEmailOtp();
      return;
    }

    if (mode.value === 'forgot-email') {
      await submitForgotEmail();
      return;
    }

    if (mode.value === 'forgot-otp') {
      await submitForgotOtp();
      return;
    }

    if (mode.value === 'forgot-reset') {
      await submitForgotResetPassword();
    }
  } catch (error) {
    if (
      ['SMS_DELIVERY_FAILED', 'EMAIL_DELIVERY_FAILED'].includes(error.code) &&
      error.details?.contact
    ) {
      verifyContact.value = error.details.contact;
      verifyChannel.value = error.details.channel || 'email';
      verifyOtp.value = '';
      setMode('verify-email');
      setFeedback(`${error.message} You can resend the code after the delivery service is configured.`, true);
    } else if (error.code === 'EMAIL_NOT_VERIFIED') {
      verifyContact.value = error.details?.contact || error.details?.email || loginIdentifier.value;
      verifyChannel.value = error.details?.channel || 'email';
      verifyOtp.value = '';
      setMode('verify-email');
      setFeedback('Your account is not verified yet. Enter the code or resend a new one.', true);
    } else if (error.code === 'PHONE_NOT_VERIFIED') {
      verifyContact.value = error.details?.contact || error.details?.phone || loginIdentifier.value;
      verifyChannel.value = error.details?.channel || 'phone';
      verifyOtp.value = '';
      setMode('verify-email');
      setFeedback('Your account is not verified yet. Enter the code or resend a new one.', true);
    } else {
      setFeedback(error.message, true);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth-layout">
    <div class="auth-card">
      <p class="kicker">Cocolytics Access</p>
      <h1 v-if="mode === 'login'">Login to your account</h1>
      <h1 v-else-if="mode === 'register'">Create your account</h1>
      <h1 v-else-if="mode === 'verify-email'">Verify your {{ verifyChannel === 'phone' ? 'phone number' : 'email' }}</h1>
      <h1 v-else-if="mode === 'forgot-email'">Forgot password</h1>
      <h1 v-else-if="mode === 'forgot-otp'">Verify reset OTP</h1>
      <h1 v-else>Create a new password</h1>
      <p class="subtitle">Step-by-step secure access with OTP verification.</p>

      <div v-if="mode === 'login' || mode === 'register'" class="tabs">
        <button type="button" :class="{ active: mode === 'login' }" @click="setMode('login')">Login</button>
        <button type="button" :class="{ active: mode === 'register' }" @click="setMode('register')">Register</button>
      </div>

      <form class="auth-form" @submit.prevent="submitForm">
        <template v-if="mode === 'register'">
          <label>
            <span>Full Name</span>
            <input v-model="fullName" type="text" placeholder="Juan Dela Cruz" required />
          </label>
          <div class="tabs contact-method" aria-label="Signup contact method">
            <button type="button" :class="{ active: contactMethod === 'email' }" @click="contactMethod = 'email'">Use Email</button>
            <button type="button" :class="{ active: contactMethod === 'phone' }" @click="contactMethod = 'phone'">Use Phone</button>
          </div>
          <label v-if="contactMethod === 'email'">
            <span>Email</span>
            <input v-model="email" type="email" autocomplete="email" placeholder="you@example.com" required />
          </label>
          <label v-else>
            <span>Phone number (include country code)</span>
            <input
              v-model="phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              placeholder="+639171234567"
              required
            />
            <small>Use international format, for example +639171234567.</small>
          </label>
          <label>
            <span>Password</span>
            <div class="password-field">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                class="password-toggle"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 4.5L19.5 21M9.9 9.9A3 3 0 0014.1 14.1M10.7 5.1A11 11 0 0112 5c5.7 0 9.6 5.1 10 6-.2.4-1.1 2-2.8 3.5M6.6 6.6C3.7 8.3 2.1 10.8 2 11c.4.9 4.3 6 10 6 1.4 0 2.8-.3 4.1-.8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2 12c.4-.9 4.3-6 10-6s9.6 5.1 10 6c-.4.9-4.3 6-10 6S2.4 12.9 2 12z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </label>
          <label>
            <span>Confirm Password</span>
            <div class="password-field">
              <input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Confirm password"
                required
              />
              <button
                type="button"
                class="password-toggle"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 4.5L19.5 21M9.9 9.9A3 3 0 0014.1 14.1M10.7 5.1A11 11 0 0112 5c5.7 0 9.6 5.1 10 6-.2.4-1.1 2-2.8 3.5M6.6 6.6C3.7 8.3 2.1 10.8 2 11c.4.9 4.3 6 10 6 1.4 0 2.8-.3 4.1-.8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2 12c.4-.9 4.3-6 10-6s9.6 5.1 10 6c-.4.9-4.3 6-10 6S2.4 12.9 2 12z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </label>
          <label>
            <span>Why do you want to become a staff?</span>
            <textarea
              v-model="staffReason"
              rows="3"
              placeholder="Tell us your reason"
              required
            ></textarea>
          </label>
        </template>

        <template v-else-if="mode === 'login'">
          <label>
            <span>Email or phone number</span>
            <input v-model="loginIdentifier" type="text" autocomplete="username" placeholder="you@example.com or +639171234567" required />
          </label>
          <label>
            <span>Password</span>
            <div class="password-field">
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                class="password-toggle"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                @click="showPassword = !showPassword"
              >
                <svg v-if="showPassword" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 4.5L19.5 21M9.9 9.9A3 3 0 0014.1 14.1M10.7 5.1A11 11 0 0112 5c5.7 0 9.6 5.1 10 6-.2.4-1.1 2-2.8 3.5M6.6 6.6C3.7 8.3 2.1 10.8 2 11c.4.9 4.3 6 10 6 1.4 0 2.8-.3 4.1-.8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M2 12c.4-.9 4.3-6 10-6s9.6 5.1 10 6c-.4.9-4.3 6-10 6S2.4 12.9 2 12z"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                </svg>
              </button>
            </div>
          </label>
        </template>

        <template v-else-if="mode === 'verify-email'">
          <label>
            <span>{{ verifyChannel === 'phone' ? 'Phone number' : 'Email' }}</span>
            <input
              v-model="verifyContact"
              :type="verifyChannel === 'phone' ? 'tel' : 'email'"
              :placeholder="verifyChannel === 'phone' ? '+639171234567' : 'you@example.com'"
              autocomplete="username"
              @input="verifyChannel = contactChannelFor(verifyContact)"
              required
            />
          </label>
          <label>
            <span>{{ verifyChannel === 'phone' ? 'SMS code' : 'Email code' }}</span>
            <input
              v-model="verifyOtp"
              type="text"
              :maxlength="verifyChannel === 'phone' ? 6 : 8"
              :inputmode="verifyChannel === 'phone' ? 'numeric' : 'text'"
              autocomplete="one-time-code"
              :placeholder="verifyChannel === 'phone' ? 'Enter 6-digit code' : 'e.g. AB12CD34'"
              @input="verifyOtp = normalizeOtpInput(verifyOtp, verifyChannel)"
              required
            />
          </label>
        </template>

        <template v-else-if="mode === 'forgot-email'">
          <label>
            <span>Email or phone number</span>
            <input
              v-model="forgotContact"
              type="text"
              autocomplete="username"
              placeholder="you@example.com or +639171234567"
              @input="forgotChannel = contactChannelFor(forgotContact)"
              required
            />
          </label>
        </template>

        <template v-else-if="mode === 'forgot-otp'">
          <label>
            <span>{{ forgotChannel === 'phone' ? 'Phone number' : 'Email' }}</span>
            <input
              v-model="forgotContact"
              :type="forgotChannel === 'phone' ? 'tel' : 'email'"
              :placeholder="forgotChannel === 'phone' ? '+639171234567' : 'you@example.com'"
              autocomplete="username"
              @input="forgotChannel = contactChannelFor(forgotContact)"
              required
            />
          </label>
          <label>
            <span>{{ forgotChannel === 'phone' ? 'SMS code' : 'Email code' }}</span>
            <input
              v-model="forgotOtp"
              type="text"
              :maxlength="forgotChannel === 'phone' ? 6 : 8"
              :inputmode="forgotChannel === 'phone' ? 'numeric' : 'text'"
              autocomplete="one-time-code"
              placeholder="Enter code"
              @input="forgotOtp = normalizeOtpInput(forgotOtp, forgotChannel)"
              required
            />
          </label>
        </template>

        <template v-else>
          <label>
            <span>New Password</span>
            <input
              v-model="forgotNewPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter new password"
              required
            />
          </label>
          <label>
            <span>Confirm Password</span>
            <input
              v-model="forgotConfirmPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Confirm new password"
              required
            />
          </label>
        </template>

        <button class="submit" type="submit" :disabled="loading">
          <span v-if="loading">Please wait...</span>
          <span v-else-if="mode === 'login'">Login</span>
          <span v-else-if="mode === 'register'">Register</span>
          <span v-else-if="mode === 'verify-email'">Verify Code</span>
          <span v-else-if="mode === 'forgot-email'">Send OTP</span>
          <span v-else-if="mode === 'forgot-otp'">Verify OTP</span>
          <span v-else>Reset Password</span>
        </button>
      </form>

      <div v-if="mode === 'login' && googleClientId" class="google-login">
        <div class="divider"><span>or continue with</span></div>
        <div ref="googleButton" class="google-button"></div>
      </div>

      <div class="actions" v-if="mode === 'login'">
        <button type="button" class="ghost" @click="openVerifyEmailScreen(loginIdentifier)">Verify Account</button>
        <button type="button" class="ghost" @click="openForgotPasswordScreen(loginIdentifier)">Forgot Password</button>
      </div>

      <div class="actions" v-else-if="mode === 'verify-email'">
        <button type="button" class="ghost" @click="resendVerifyOtp" :disabled="loading">Resend OTP</button>
        <button type="button" class="ghost" @click="setMode('login')">Back to Login</button>
      </div>

      <div class="actions" v-else-if="mode === 'forgot-email' || mode === 'forgot-otp' || mode === 'forgot-reset'">
        <button
          v-if="mode === 'forgot-otp'"
          type="button"
          class="ghost"
          @click="resendForgotOtp"
          :disabled="loading"
        >
          Resend OTP
        </button>
        <button type="button" class="ghost" @click="openForgotPasswordScreen(forgotContact)">Start Over</button>
        <button type="button" class="ghost" @click="setMode('login')">Back to Login</button>
      </div>

      <p v-if="feedback" :class="['feedback', { error: isError }]">{{ feedback }}</p>

      <button class="back-home" type="button" @click="router.push('/')">Back to Home</button>
    </div>
  </section>
</template>

<style scoped>
.auth-layout {
  min-height: 100vh;
  padding: 1rem;
  display: grid;
  place-items: center;
}

.auth-card {
  width: min(100%, 520px);
  border-radius: 22px;
  border: 1px solid rgba(95, 213, 176, 0.35);
  background: linear-gradient(160deg, rgba(9, 36, 47, 0.9), rgba(11, 57, 72, 0.76));
  padding: 1rem;
  color: #e8fff4;
}

.kicker {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #90efc7;
}

h1 {
  margin: 0.5rem 0 0;
  font-size: 1.5rem;
}

.subtitle {
  margin: 0.45rem 0 0;
  color: #c3f6df;
  font-size: 0.9rem;
}

.tabs {
  margin-top: 1rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.tabs button,
.submit,
.back-home,
.ghost {
  border: 1px solid rgba(117, 227, 189, 0.4);
  border-radius: 10px;
  background: rgba(13, 47, 59, 0.75);
  color: #e7fff5;
  font-weight: 700;
  font-size: 0.86rem;
  padding: 0.62rem 0.72rem;
}

.tabs button.active {
  background: rgba(75, 192, 154, 0.28);
}

.auth-form {
  margin-top: 0.85rem;
  display: grid;
  gap: 0.65rem;
}

.google-login {
  margin-top: 1rem;
}

.divider {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #a9d9c5;
  font-size: 0.74rem;
}

.divider::before,
.divider::after {
  content: '';
  height: 1px;
  flex: 1;
  background: rgba(117, 227, 189, 0.28);
}

.google-button {
  display: flex;
  justify-content: center;
  margin-top: 0.75rem;
  min-height: 40px;
}

label {
  display: grid;
  gap: 0.3rem;
}

label span {
  font-size: 0.78rem;
  color: #c5f7e2;
}

input,
textarea,
select {
  border: 1px solid rgba(109, 218, 181, 0.35);
  border-radius: 10px;
  background: rgba(7, 25, 33, 0.88);
  color: #eefff8;
  padding: 0.62rem 0.7rem;
  font-size: 0.85rem;
  width: 100%;
}

textarea {
  font: inherit;
  resize: vertical;
}

.password-field {
  position: relative;
}

.password-field input {
  padding-right: 2.5rem;
}

.password-toggle {
  position: absolute;
  right: 0.45rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.8rem;
  height: 1.8rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #a4f4d3;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.password-toggle svg {
  width: 1.1rem;
  height: 1.1rem;
}

.password-toggle:hover {
  background: rgba(117, 227, 189, 0.14);
}

.password-toggle:focus-visible {
  outline: 2px solid rgba(151, 243, 204, 0.7);
  outline-offset: 1px;
}

.submit {
  margin-top: 0.2rem;
  background: linear-gradient(135deg, #9ff9cf, #46d2a6);
  color: #063028;
}

.actions {
  margin-top: 0.6rem;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.ghost {
  background: transparent;
}

.feedback {
  margin: 0.8rem 0 0;
  color: #8ff1c7;
  font-size: 0.82rem;
}

.feedback.error {
  color: #ffb7c0;
}

.back-home {
  margin-top: 0.75rem;
  width: 100%;
  background: transparent;
}
</style>
