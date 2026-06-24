<template>
  <div class="login-scene">
    <section class="left-panel" aria-hidden="true">
      <div class="base-gradient"></div>
      <div class="grid-bg"></div>
      <div class="hex-pattern"></div>
      <div class="radar-rings">
        <span class="ring r1"></span>
        <span class="ring r2"></span>
        <span class="ring r3"></span>
      </div>
      <div class="lantern-lines">
        <span class="line l1"></span>
        <span class="line l2"></span>
        <span class="line l3"></span>
        <span class="line l4"></span>
        <span class="line l5"></span>
      </div>
      <div class="network-layer">
        <span class="node n1"></span>
        <span class="node n2"></span>
        <span class="node n3"></span>
        <span class="node n4"></span>
        <span class="node n5"></span>
        <span class="node n6"></span>
        <span class="edge e1"></span>
        <span class="edge e2"></span>
        <span class="edge e3"></span>
        <span class="edge e4"></span>
      </div>
      <div class="data-bars">
        <span class="bar b1"></span>
        <span class="bar b2"></span>
        <span class="bar b3"></span>
        <span class="bar b4"></span>
        <span class="bar b5"></span>
        <span class="bar b6"></span>
      </div>

      <div class="left-content">
        <div class="brand-mark">
          <svg viewBox="0 0 64 64" fill="none" role="img">
            <rect x="8" y="8" width="48" height="48" rx="15" fill="rgba(91, 107, 255, .08)" stroke="rgba(91, 107, 255, .28)" />
            <circle cx="32" cy="32" r="13" stroke="rgba(91, 107, 255, .72)" stroke-width="2" />
            <circle cx="32" cy="32" r="4" fill="#5b6bff" />
            <path d="M32 15v8M32 41v8M15 32h8M41 32h8" stroke="#5b6bff" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <h1 class="left-title">AI SRE<span>工具箱</span></h1>
        <p class="left-sub">智能站点可靠性工程平台</p>
        <div class="stat-row">
          <div class="stat">
            <strong>7×24</strong>
            <span>持续守护</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <strong>AI</strong>
            <span>智能驱动</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat">
            <strong>Security</strong>
            <span>安全可靠</span>
          </div>
        </div>
      </div>
    </section>

    <section class="right-panel">
      <el-form ref="loginForm" :model="loginForm" :rules="loginRules" class="login-card">
        <div class="lock-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="11" width="14" height="11" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
            <circle cx="12" cy="16" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h3 class="card-title">登录</h3>
        <p class="card-sub">登录以继续使用 AI SRE 工具箱</p>
        <div class="form-divider"></div>

        <label class="field-label">用户名</label>
        <el-form-item prop="username" class="field">
          <el-input
            v-model="loginForm.username"
            type="text"
            auto-complete="off"
            placeholder="输入用户名"
          >
            <svg-icon slot="prefix" icon-class="user" class="input-icon" />
          </el-input>
        </el-form-item>

        <label class="field-label">密码</label>
        <el-form-item prop="password" class="field">
          <el-input
            v-model="loginForm.password"
            type="password"
            auto-complete="off"
            placeholder="输入密码"
            show-password
            @keyup.enter.native="handleLogin"
          >
            <svg-icon slot="prefix" icon-class="password" class="input-icon" />
          </el-input>
        </el-form-item>

        <div v-if="captchaEnabled" class="captcha-row">
          <div class="captcha-field">
            <label class="field-label">验证码</label>
            <el-form-item prop="code" class="field">
              <el-input
                v-model="loginForm.code"
                auto-complete="off"
                placeholder="输入验证码"
                @keyup.enter.native="handleLogin"
              >
                <svg-icon slot="prefix" icon-class="validCode" class="input-icon" />
              </el-input>
            </el-form-item>
          </div>
          <button class="login-code" type="button" title="点击刷新验证码" @click="getCode">
            <img :src="codeUrl" class="login-code-img">
          </button>
        </div>

        <div class="form-options">
          <el-checkbox v-model="loginForm.rememberMe">记住密码</el-checkbox>
          <router-link v-if="register" class="register-link" :to="'/register'">立即注册</router-link>
        </div>

        <el-button
          :loading="loading"
          class="btn-login"
          type="primary"
          @click.native.prevent="handleLogin"
        >
          <span v-if="!loading">登 录</span>
          <span v-else>登 录 中...</span>
        </el-button>
      </el-form>
    </section>

    <div class="el-login-footer">
      <span>{{ footerContent }}</span>
    </div>
  </div>
</template>

<script>
import { getCodeImg } from "@/api/login"
import Cookies from "js-cookie"
import { encrypt, decrypt } from '@/utils/jsencrypt'
import defaultSettings from '@/settings'

const STANDALONE_REDIRECT_PREFIXES = ['/skill-ide/', '/dblens/', '/agent-platform/']

function isHttpUrl(url) {
  return /^https?:\/\//i.test(url || '')
}

function safeSameOriginUrl(url) {
  try {
    const target = new URL(url, window.location.origin)
    return target.origin === window.location.origin ? target.href : ''
  } catch (error) {
    return ''
  }
}

function isStandaloneRedirect(url) {
  if (!url) return false
  try {
    const target = new URL(url, window.location.origin)
    return target.origin === window.location.origin
      && STANDALONE_REDIRECT_PREFIXES.some(prefix => target.pathname === prefix.slice(0, -1) || target.pathname.startsWith(prefix))
  } catch (error) {
    return false
  }
}

export default {
  name: "Login",
  data() {
    return {
      title: process.env.VUE_APP_TITLE,
      footerContent: defaultSettings.footerContent,
      codeUrl: "",
      loginForm: {
        username: "admin",
        password: "admin123",
        rememberMe: false,
        code: "",
        uuid: ""
      },
      loginRules: {
        username: [
          { required: true, trigger: "blur", message: "请输入您的账号" }
        ],
        password: [
          { required: true, trigger: "blur", message: "请输入您的密码" }
        ],
        code: [{ required: true, trigger: "change", message: "请输入验证码" }]
      },
      loading: false,
      captchaEnabled: true,
      register: false,
      redirect: undefined
    }
  },
  watch: {
    $route: {
      handler: function(route) {
        this.redirect = route.query && route.query.redirect
      },
      immediate: true
    }
  },
  created() {
    this.getCode()
    this.getCookie()
  },
  methods: {
    getCode() {
      getCodeImg().then(res => {
        this.captchaEnabled = res.captchaEnabled === undefined ? true : res.captchaEnabled
        if (this.captchaEnabled) {
          this.codeUrl = "data:image/gif;base64," + res.img
          this.loginForm.uuid = res.uuid
        }
      })
    },
    getCookie() {
      const username = Cookies.get("username")
      const password = Cookies.get("password")
      const rememberMe = Cookies.get('rememberMe')
      this.loginForm = {
        username: username === undefined ? this.loginForm.username : username,
        password: password === undefined ? this.loginForm.password : decrypt(password),
        rememberMe: rememberMe === undefined ? false : Boolean(rememberMe)
      }
    },
    redirectAfterLogin() {
      const redirect = this.redirect || "/"
      if (isHttpUrl(redirect)) {
        const target = safeSameOriginUrl(redirect)
        if (target) {
          window.location.href = target
        } else {
          this.$router.push({ path: "/" }).catch(()=>{})
        }
        return
      }
      if (isStandaloneRedirect(redirect)) {
        const target = safeSameOriginUrl(redirect)
        window.location.href = target || redirect
        return
      }
      this.$router.push({ path: redirect }).catch(()=>{})
    },
    handleLogin() {
      this.$refs.loginForm.validate(valid => {
        if (valid) {
          this.loading = true
          if (this.loginForm.rememberMe) {
            Cookies.set("username", this.loginForm.username, { expires: 30 })
            Cookies.set("password", encrypt(this.loginForm.password), { expires: 30 })
            Cookies.set('rememberMe', this.loginForm.rememberMe, { expires: 30 })
          } else {
            Cookies.remove("username")
            Cookies.remove("password")
            Cookies.remove('rememberMe')
          }
          this.$store.dispatch("Login", this.loginForm).then(() => {
            this.redirectAfterLogin()
          }).catch(() => {
            this.loading = false
            if (this.captchaEnabled) {
              this.getCode()
            }
          })
        }
      })
    }
  }
}
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
.login-scene {
  --login-bg-base: #f6f8fc;
  --login-bg-elevated: #ffffff;
  --login-text-primary: #172033;
  --login-text-secondary: #596276;
  --login-text-muted: #8b94a8;
  --login-accent: #5b6bff;
  --login-accent-rgb: 91, 107, 255;
  --login-green-rgb: 20, 184, 166;
  --login-border: #e2e7f0;
  --login-border-focus: #7683ff;
  --login-radius-md: 8px;

  width: 100vw;
  height: 100vh;
  display: flex;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  background: var(--login-bg-base);
}

.left-panel {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--login-bg-base);
}

.base-gradient {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 80% 60% at 30% 40%, rgba(var(--login-accent-rgb), 0.07) 0%, transparent 60%),
    radial-gradient(ellipse 50% 40% at 70% 70%, rgba(var(--login-green-rgb), 0.04) 0%, transparent 50%),
    radial-gradient(circle at 50% 20%, rgba(var(--login-accent-rgb), 0.03) 0%, transparent 40%);
}

.grid-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(var(--login-accent-rgb), 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(var(--login-accent-rgb), 0.04) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 70% 70% at 55% 50%, black 25%, transparent 65%);
}

.hex-pattern {
  position: absolute;
  inset: -40px;
  pointer-events: none;
  opacity: 0.08;
  background-image:
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='96'%3E%3Cpath d='M28 0L56 16v32L28 64 0 48V16z' fill='none' stroke='%235b6bff' stroke-width='0.5'/%3E%3C/svg%3E");
  background-size: 112px 192px;
  mask-image: radial-gradient(ellipse 60% 60% at 55% 50%, black 20%, transparent 65%);
}

.radar-rings {
  position: absolute;
  pointer-events: none;
  top: 45%;
  left: 40%;
}

.ring {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(var(--login-accent-rgb), 0.06);
  transform: translate(-50%, -50%);
}

.r1 { width: 120px; height: 120px; }
.r2 { width: 220px; height: 220px; border-color: rgba(var(--login-accent-rgb), 0.04); }
.r3 { width: 340px; height: 340px; border-color: rgba(var(--login-accent-rgb), 0.025); border-style: dashed; }

.lantern-lines {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.line {
  position: absolute;
  background: linear-gradient(90deg, transparent, rgba(var(--login-accent-rgb), 0.06), transparent);
  height: 1px;
  left: 0;
  right: 40%;
}

.l1 { top: 18%; right: 35%; }
.l2 { top: 34%; right: 30%; left: 8%; }
.l3 { top: 50%; right: 42%; left: 0; }
.l4 { top: 66%; right: 25%; left: 5%; }
.l5 { top: 82%; right: 20%; left: 12%; }

.network-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.node {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(var(--login-accent-rgb), 0.3);
  box-shadow: 0 0 6px rgba(var(--login-accent-rgb), 0.2);
}

.n1 { top: 15%; left: 55%; }
.n2 { top: 28%; left: 70%; }
.n3 { top: 40%; left: 62%; }
.n4 { top: 55%; left: 78%; }
.n5 { top: 65%; left: 58%; }
.n6 { top: 18%; left: 82%; }

.edge {
  position: absolute;
  height: 1px;
  background: rgba(var(--login-accent-rgb), 0.04);
  transform-origin: left center;
}

.e1 { top: 15.5%; left: 55.2%; width: 14.8%; }
.e2 { top: 28.5%; left: 70.2%; width: 8.2%; transform: rotate(30deg); }
.e3 { top: 28.5%; left: 62.2%; width: 8%; transform: rotate(-20deg); }
.e4 { top: 55.5%; left: 58.2%; width: 19.8%; }

.data-bars {
  position: absolute;
  pointer-events: none;
  bottom: 12%;
  right: 8%;
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 80px;
  opacity: 0.15;
}

.bar {
  width: 3px;
  border-radius: 2px;
  background: var(--login-accent);
}

.b1 { height: 28px; }
.b2 { height: 52px; }
.b3 { height: 38px; }
.b4 { height: 68px; }
.b5 { height: 44px; }
.b6 { height: 22px; }

.left-content {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 0 48px;
}

.brand-mark {
  margin: 0 auto 28px;
  width: 80px;
  height: 80px;
  filter: drop-shadow(0 8px 24px rgba(var(--login-accent-rgb), 0.22));

  svg {
    width: 80px;
    height: 80px;
    display: block;
  }
}

.left-title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 800;
  color: var(--login-text-primary);
  letter-spacing: 0;

  span {
    margin-left: 3px;
    font-weight: 500;
    color: var(--login-text-secondary);
  }
}

.left-sub {
  margin: 0 0 48px;
  font-size: 14px;
  color: var(--login-text-muted);
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 28px;

  strong {
    font-size: 18px;
    font-weight: 800;
    color: var(--login-text-primary);
  }

  span {
    font-size: 11px;
    color: var(--login-text-muted);
  }
}

.stat-divider {
  width: 1px;
  height: 36px;
  background: var(--login-border);
}

.right-panel {
  width: 440px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  background: var(--login-bg-elevated);
  border-left: 1px solid var(--login-border);
  box-shadow: -1px 0 0 rgba(20, 32, 54, 0.04), -8px 0 24px rgba(20, 32, 54, 0.04);
}

.login-card {
  width: 100%;
  max-width: 344px;
}

.lock-icon {
  width: 40px;
  height: 40px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--login-accent);

  svg {
    width: 24px;
    height: 24px;
  }
}

.card-title {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 800;
  color: var(--login-text-primary);
}

.card-sub {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--login-text-muted);
}

.form-divider {
  height: 1px;
  background: var(--login-border);
  margin-bottom: 24px;
}

.field-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--login-text-secondary);
}

.field {
  margin-bottom: 18px;
}

.captcha-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
}

.captcha-field {
  flex: 1;
  min-width: 0;
}

.login-code {
  width: 112px;
  height: 42px;
  margin-bottom: 18px;
  padding: 0;
  border: 1px solid var(--login-border);
  border-radius: var(--login-radius-md);
  background: var(--login-bg-base);
  overflow: hidden;
  cursor: pointer;
}

.login-code-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.form-options {
  min-height: 22px;
  margin: -2px 0 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.register-link {
  font-size: 12px;
  color: var(--login-accent);
}

.btn-login {
  width: 100%;
  height: 42px;
  border: 1px solid rgba(var(--login-accent-rgb), 0.28);
  border-radius: var(--login-radius-md);
  background: var(--login-accent);
  font-size: 14px;
  font-weight: 700;
  transition: background 0.18s, box-shadow 0.18s, transform 0.15s, filter 0.18s;

  &:hover,
  &:focus {
    background: linear-gradient(135deg, var(--login-accent) 0%, #4653de 100%);
    box-shadow: 0 4px 16px rgba(var(--login-accent-rgb), 0.28), 0 0 0 3px rgba(var(--login-accent-rgb), 0.1);
    transform: translateY(-1px);
    filter: brightness(1.03);
  }
}

.el-login-footer {
  position: fixed;
  bottom: 14px;
  left: 24px;
  right: 464px;
  text-align: center;
  color: var(--login-text-muted);
  font-size: 12px;
  letter-spacing: 0;
  pointer-events: none;
}

::v-deep .el-form-item__content {
  line-height: normal;
}

::v-deep .el-input__inner {
  height: 42px;
  line-height: 42px;
  padding-left: 38px;
  border: 1px solid var(--login-border);
  border-radius: var(--login-radius-md);
  background: var(--login-bg-base);
  color: var(--login-text-primary);
  font-size: 13px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

::v-deep .el-input__inner::placeholder {
  color: var(--login-text-muted);
}

::v-deep .el-input__inner:focus {
  border-color: var(--login-border-focus);
  box-shadow: 0 0 0 3px rgba(var(--login-accent-rgb), 0.1);
}

::v-deep .el-input__prefix {
  left: 12px;
  display: flex;
  align-items: center;
}

.input-icon {
  width: 16px;
  height: 16px;
  color: var(--login-text-muted);
}

::v-deep .el-checkbox__label {
  color: var(--login-text-secondary);
  font-size: 12px;
}

::v-deep .el-checkbox__input.is-checked + .el-checkbox__label {
  color: var(--login-text-secondary);
}

::v-deep .el-checkbox__input.is-checked .el-checkbox__inner {
  background-color: var(--login-accent);
  border-color: var(--login-accent);
}

@media (max-width: 768px) {
  .left-panel {
    display: none;
  }

  .right-panel {
    flex: 1;
    width: auto;
    border-left: 0;
    box-shadow: none;
  }

  .el-login-footer {
    left: 0;
    right: 0;
  }
}
</style>
