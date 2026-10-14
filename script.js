document.addEventListener('DOMContentLoaded', function () {
    'use strict';

    const CONFIG = window.SGM_CONFIG || {};
    const TRANSLATIONS = window.SGM_TRANSLATIONS || {};
    const SUPPORTED_LANGUAGES = CONFIG.SUPPORTED_LANGUAGES || ['en', 'es'];
    const DEFAULT_LANGUAGE = CONFIG.DEFAULT_LANGUAGE || 'en';
    const LANGUAGE_STORAGE_KEY = 'selectedLanguage';

    let currentLanguage = DEFAULT_LANGUAGE;

    /* ------------------------------------------------------------------
     * Internationalization (English by default, Spanish on demand)
     * ------------------------------------------------------------------ */

    // Resolves "a.b.c" against the dictionary of the given language, falling
    // back to English when a key is missing.
    function t(key, lang) {
        const lookup = (dict) => key.split('.').reduce(
            (obj, part) => (obj && Object.prototype.hasOwnProperty.call(obj, part) ? obj[part] : undefined),
            dict
        );
        const value = lookup(TRANSLATIONS[lang || currentLanguage]);
        if (typeof value === 'string') return value;
        const fallback = lookup(TRANSLATIONS[DEFAULT_LANGUAGE]);
        return typeof fallback === 'string' ? fallback : key;
    }

    function safeStorageGet(key) {
        try { return window.localStorage.getItem(key); } catch (e) { return null; }
    }

    function safeStorageSet(key, value) {
        try { window.localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ }
    }

    function applyTranslations(lang) {
        if (!SUPPORTED_LANGUAGES.includes(lang) || !TRANSLATIONS[lang]) {
            lang = DEFAULT_LANGUAGE;
        }
        currentLanguage = lang;
        document.documentElement.lang = lang;
        document.title = t('pageTitle');

        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        // Only used for trusted, static strings from translations.js (never user input).
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            el.innerHTML = t(el.dataset.i18nHtml);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
        });
        document.querySelectorAll('[data-i18n-alt]').forEach(el => {
            el.setAttribute('alt', t(el.dataset.i18nAlt));
        });
        document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
            el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
        });
        document.querySelectorAll('[data-i18n-content]').forEach(el => {
            el.setAttribute('content', t(el.dataset.i18nContent));
        });

        // Re-translate any validation errors currently on screen.
        document.querySelectorAll('#quote-form .error').forEach(field => validateField(field));

        const languageSelector = document.getElementById('language-selector');
        if (languageSelector) languageSelector.value = lang;
    }

    function getInitialLanguage() {
        const fromUrl = new URLSearchParams(window.location.search).get('lang');
        if (fromUrl && SUPPORTED_LANGUAGES.includes(fromUrl)) return fromUrl;
        const saved = safeStorageGet(LANGUAGE_STORAGE_KEY);
        if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
        return DEFAULT_LANGUAGE;
    }

    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        languageSelector.addEventListener('change', function (e) {
            const lang = e.target.value;
            applyTranslations(lang);
            safeStorageSet(LANGUAGE_STORAGE_KEY, currentLanguage);
        });
    }

    /* ------------------------------------------------------------------
     * Responsive menu
     * ------------------------------------------------------------------ */
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    function setMenuOpen(open) {
        navMenu.classList.toggle('show', open);
        menuToggle.classList.toggle('active', open);
        menuToggle.setAttribute('aria-expanded', String(open));
    }

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function () {
            setMenuOpen(!navMenu.classList.contains('show'));
        });

        // Close the menu after choosing a link (mobile)
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => setMenuOpen(false));
        });

        // Close the menu when clicking outside of it (mobile)
        document.addEventListener('click', function (event) {
            if (!menuToggle.contains(event.target) && !navMenu.contains(event.target)) {
                setMenuOpen(false);
            }
        });
    }

    /* ------------------------------------------------------------------
     * Quote form: validation
     * ------------------------------------------------------------------ */
    const quoteForm = document.getElementById('quote-form');
    const formMessage = document.getElementById('form-message');
    const formLoadedAt = Date.now();
    const MIN_FILL_TIME_MS = 3000;
    const REQUEST_TIMEOUT_MS = 20000;

    const NAME_REGEX = /^[\p{L}][\p{L}\p{M}\s'.-]{1,99}$/u;
    const EMAIL_REGEX = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
    const PHONE_REGEX = /^\+?[0-9\s\-().]{7,25}$/;
    // Links and markup are rejected to keep the form from being used to deliver phishing links.
    const LINK_OR_HTML_REGEX = /(https?:\/\/|www\.|<[^>]*>|\[url|href\s*=)/i;
    const ALLOWED_SERVICES = ['office', 'floors', 'condos', 'residential', 'commercial', 'snow'];

    function getFieldError(field) {
        const value = field.type === 'checkbox' ? field.checked : field.value.trim();

        if (field.type === 'checkbox') {
            return field.required && !value ? 'form.errors.consent' : '';
        }
        if (field.required && !value) return 'form.errors.required';
        if (!value) return '';

        switch (field.name) {
            case 'name':
                return NAME_REGEX.test(value) ? '' : 'form.errors.name';
            case 'email':
                return value.length <= 254 && EMAIL_REGEX.test(value) ? '' : 'form.errors.email';
            case 'phone': {
                const digits = value.replace(/\D/g, '');
                return PHONE_REGEX.test(value) && digits.length >= 7 && digits.length <= 15 ? '' : 'form.errors.phone';
            }
            case 'service':
                return ALLOWED_SERVICES.includes(value) ? '' : 'form.errors.required';
            case 'message':
                return LINK_OR_HTML_REGEX.test(value) ? 'form.errors.message' : '';
            default:
                return '';
        }
    }

    function validateField(field) {
        const container = field.closest('.form-field') || field.parentNode;
        const existingError = container.querySelector('.field-error');
        if (existingError) existingError.remove();
        field.classList.remove('error');
        field.removeAttribute('aria-invalid');

        const errorKey = getFieldError(field);
        if (!errorKey) return true;

        field.classList.add('error');
        field.setAttribute('aria-invalid', 'true');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = t(errorKey);
        container.appendChild(errorDiv);
        return false;
    }

    function showFormMessage(type, key) {
        if (!formMessage) return;
        formMessage.textContent = '';
        const div = document.createElement('div');
        div.className = type === 'success' ? 'success-message' : 'error-message';
        div.textContent = t(key);
        formMessage.appendChild(div);
    }

    /* ------------------------------------------------------------------
     * Quote form: optional Cloudflare Turnstile anti-bot check
     * ------------------------------------------------------------------ */
    let turnstileWidgetId = null;

    function initTurnstile() {
        const container = document.getElementById('turnstile-container');
        if (!CONFIG.TURNSTILE_SITE_KEY || !container) return;

        window.onSgmTurnstileLoad = function () {
            turnstileWidgetId = window.turnstile.render(container, {
                sitekey: CONFIG.TURNSTILE_SITE_KEY,
                theme: 'dark',
                language: currentLanguage
            });
        };
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onSgmTurnstileLoad';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }

    function resetTurnstile() {
        if (turnstileWidgetId !== null && window.turnstile) {
            window.turnstile.reset(turnstileWidgetId);
        }
    }

    /* ------------------------------------------------------------------
     * Quote form: submission
     * ------------------------------------------------------------------ */
    if (quoteForm) {
        const fields = quoteForm.querySelectorAll('.form-field input, .form-field select, .form-field textarea');

        fields.forEach(field => {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener(field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input', () => {
                // The message is checked while typing so a link warning does not
                // appear on blur and shift the layout under the user's next click.
                if (field.classList.contains('error') || field.tagName === 'TEXTAREA') validateField(field);
            });
        });

        initTurnstile();

        let isSubmitting = false;

        quoteForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (isSubmitting) return;

            if (formMessage) formMessage.textContent = '';

            // Client-side validation (the backend validates everything again).
            let firstInvalid = null;
            fields.forEach(field => {
                if (!validateField(field) && !firstInvalid) firstInvalid = field;
            });
            if (firstInvalid) {
                showFormMessage('error', 'form.fixErrors');
                firstInvalid.focus();
                return;
            }

            if (Date.now() - formLoadedAt < MIN_FILL_TIME_MS) {
                showFormMessage('error', 'form.tooFast');
                return;
            }

            const formData = new FormData(quoteForm);
            if (CONFIG.TURNSTILE_SITE_KEY && !formData.get('cf-turnstile-response')) {
                showFormMessage('error', 'form.captcha');
                return;
            }

            if (!CONFIG.FORM_ENDPOINT) {
                console.error('FORM_ENDPOINT is not configured in config.js');
                showFormMessage('error', 'form.error');
                return;
            }

            // Only whitelisted, trimmed fields are sent.
            const payload = new URLSearchParams();
            payload.append('name', String(formData.get('name') || '').trim());
            payload.append('email', String(formData.get('email') || '').trim().toLowerCase());
            payload.append('phone', String(formData.get('phone') || '').trim());
            payload.append('service', String(formData.get('service') || ''));
            payload.append('message', String(formData.get('message') || '').trim());
            payload.append('consent', formData.get('consent') === 'yes' ? 'yes' : 'no');
            payload.append('website', String(formData.get('website') || '')); // honeypot
            payload.append('elapsed', String(Date.now() - formLoadedAt));
            payload.append('lang', currentLanguage);
            payload.append('turnstileToken', String(formData.get('cf-turnstile-response') || ''));

            const submitButton = quoteForm.querySelector('button[type="submit"]');
            isSubmitting = true;
            submitButton.disabled = true;
            submitButton.textContent = t('form.sending');

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

            // application/x-www-form-urlencoded is a "simple" CORS request, so the
            // browser does not send a preflight (which Google Apps Script rejects).
            fetch(CONFIG.FORM_ENDPOINT, {
                method: 'POST',
                body: payload,
                redirect: 'follow',
                credentials: 'omit',
                referrerPolicy: 'strict-origin-when-cross-origin',
                signal: controller.signal
            })
                .then(response => {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.json();
                })
                .then(result => {
                    if (result && result.result === 'success') {
                        showFormMessage('success', 'form.success');
                        quoteForm.reset();
                        return;
                    }
                    const code = result && result.code;
                    if (code === 'rate_limited') {
                        showFormMessage('error', 'form.rateLimited');
                    } else if (code === 'captcha_failed') {
                        showFormMessage('error', 'form.captcha');
                    } else if (code === 'too_fast') {
                        showFormMessage('error', 'form.tooFast');
                    } else if (code === 'invalid' && Array.isArray(result.fields) && result.fields.length) {
                        result.fields.forEach(name => {
                            const field = quoteForm.querySelector('[name="' + CSS.escape(String(name)) + '"]');
                            if (field) validateField(field);
                        });
                        showFormMessage('error', 'form.fixErrors');
                    } else {
                        showFormMessage('error', 'form.error');
                    }
                })
                .catch(error => {
                    console.error('Quote form error:', error);
                    showFormMessage('error', 'form.connectionError');
                })
                .finally(() => {
                    clearTimeout(timeoutId);
                    isSubmitting = false;
                    submitButton.disabled = false;
                    submitButton.textContent = t('form.submit');
                    resetTurnstile();
                });
        });
    }

    /* ------------------------------------------------------------------
     * Apply the initial language (after the form helpers are defined)
     * ------------------------------------------------------------------ */
    applyTranslations(getInitialLanguage());

    /* ------------------------------------------------------------------
     * Smooth scrolling for in-page links
     * ------------------------------------------------------------------ */
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            e.preventDefault();

            if (targetId === '#inicio') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const offsetTop = targetElement.getBoundingClientRect().top + window.pageYOffset;
                const headerHeight = document.querySelector('header').offsetHeight;
                window.scrollTo({ top: offsetTop - headerHeight - 20, behavior: 'smooth' });
            }
        });
    });

    /* ------------------------------------------------------------------
     * Entrance animations
     * ------------------------------------------------------------------ */
    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('animate-in');
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.service-item, .offer-item, .testimonial-item, .about-text, .about-image')
        .forEach(el => observer.observe(el));

    /* ------------------------------------------------------------------
     * Drag-to-scroll offers slider
     * ------------------------------------------------------------------ */
    const offerSlider = document.querySelector('.offer-slider');
    if (offerSlider) {
        let isDown = false;
        let startX;
        let scrollLeft;

        offerSlider.addEventListener('mousedown', (e) => {
            isDown = true;
            offerSlider.classList.add('active');
            startX = e.pageX - offerSlider.offsetLeft;
            scrollLeft = offerSlider.scrollLeft;
        });

        ['mouseleave', 'mouseup'].forEach(evt => offerSlider.addEventListener(evt, () => {
            isDown = false;
            offerSlider.classList.remove('active');
        }));

        offerSlider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - offerSlider.offsetLeft;
            offerSlider.scrollLeft = scrollLeft - (x - startX) * 2;
        });
    }

    /* ------------------------------------------------------------------
     * Header behaviour on scroll
     * ------------------------------------------------------------------ */
    let lastScrollTop = 0;
    const header = document.querySelector('header');

    window.addEventListener('scroll', function () {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        header.classList.toggle('scrolled', scrollTop > 100);
        header.style.transform = (scrollTop > lastScrollTop && scrollTop > 200) ? 'translateY(-100%)' : 'translateY(0)';
        lastScrollTop = scrollTop;
    }, { passive: true });

    /* ------------------------------------------------------------------
     * Hero video fallback
     * ------------------------------------------------------------------ */
    const heroVideo = document.querySelector('.hero-video');
    if (heroVideo) {
        heroVideo.addEventListener('error', function () {
            const hero = document.querySelector('#hero');
            hero.style.backgroundImage = 'url("floorma.jpg")';
            hero.style.backgroundSize = 'cover';
            hero.style.backgroundPosition = 'center';
        }, true);
    }

    const yearEl = document.getElementById('current-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
});
