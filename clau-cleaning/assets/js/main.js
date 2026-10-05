/* Clau Cleaning Corp — site script */
(function () {
    'use strict';

    // Google Apps Script web-app URL that stores quote requests (see backend/README.md).
    // Only this exact origin is allowed by the Content-Security-Policy in index.html.
    var FORM_ENDPOINT = '';

    var lang = document.documentElement.lang === 'es' ? 'es' : 'en';
    var MSG = {
        en: {
            sending: 'Sending…',
            success: 'Thank you! Your request was received. We will contact you within one business day.',
            error: 'We could not send your request. Please try again or call +1 978-328-2406.',
            notConfigured: 'The online form is being set up. Please call +1 978-328-2406 or email claucleaningcorpc2@gmail.com.',
            tooFast: 'Please wait a moment before sending another request.',
            required: 'This field is required.',
            email: 'Please enter a valid email address.',
            phone: 'Please enter a valid phone number.',
            name: 'Please enter your full name.',
            consent: 'Please accept so we can contact you.'
        },
        es: {
            sending: 'Enviando…',
            success: '¡Gracias! Recibimos su solicitud. Le contactaremos en menos de un día hábil.',
            error: 'No pudimos enviar su solicitud. Inténtelo de nuevo o llame al +1 978-328-2406.',
            notConfigured: 'El formulario en línea se está configurando. Llame al +1 978-328-2406 o escriba a claucleaningcorpc2@gmail.com.',
            tooFast: 'Por favor espere un momento antes de enviar otra solicitud.',
            required: 'Este campo es obligatorio.',
            email: 'Ingrese un correo electrónico válido.',
            phone: 'Ingrese un número de teléfono válido.',
            name: 'Ingrese su nombre completo.',
            consent: 'Acepte para que podamos contactarle.'
        }
    }[lang];

    /* ---------- Header & mobile menu ---------- */
    var header = document.querySelector('.site-header');
    var toggle = document.getElementById('menu-toggle');
    var menu = document.getElementById('nav-menu');

    function setMenu(open) {
        menu.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
    }
    if (toggle && menu) {
        toggle.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
        menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
        document.addEventListener('click', function (e) {
            if (menu.classList.contains('open') && !menu.contains(e.target) && !toggle.contains(e.target)) setMenu(false);
        });
    }
    function onScroll() { header.classList.toggle('scrolled', window.scrollY > 20); }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    /* ---------- Image fallback (keeps layout branded if a remote photo fails) ---------- */
    var ICONS = {
        medical: 'M10 3h4v5h5v4h-5v5h-4v-5H5V8h5z',
        schools: 'M12 3 1 9l11 6 9-4.9V17h2V9zM5 13.2v4L12 21l7-3.8v-4L12 17z',
        offices: 'M3 21V3h12v6h6v12zm2-2h2v-2H5zm0-4h2v-2H5zm0-4h2V9H5zm0-4h2V5H5zm4 12h2v-2H9zm0-4h2v-2H9zm0-4h2V9H9zm0-4h2V5H9zm4 12h6v-8h-6z',
        homes: 'M12 3 2 12h3v8h5v-6h4v6h5v-8h3z',
        disinfection: 'M12 2s-7 8-7 13a7 7 0 0 0 14 0c0-5-7-13-7-13z'
    };
    function placeholder(cat) {
        var d = ICONS[cat] || ICONS.disinfection;
        return 'data:image/svg+xml,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="#86BC42"/><stop offset="1" stop-color="#1F7F45"/></linearGradient></defs>' +
            '<rect width="400" height="300" fill="url(#g)"/><circle cx="330" cy="40" r="120" fill="#fff" opacity=".07"/><circle cx="60" cy="280" r="90" fill="#fff" opacity=".06"/>' +
            '<g transform="translate(164 114) scale(3)"><path d="' + d + '" fill="#fff" opacity=".9"/></g></svg>');
    }
    // Keeps the layout branded if a remote photo fails to load.
    document.querySelectorAll('img').forEach(function (img) {
        img.addEventListener('error', function handler() {
            img.removeEventListener('error', handler);
            if (img.getAttribute('data-ph') === 'hide') { img.hidden = true; return; }
            var host = img.closest('[data-cat]');
            img.removeAttribute('srcset');
            img.src = placeholder(img.getAttribute('data-ph') || (host && host.getAttribute('data-cat')));
        });
    });

    /* ---------- Reveal on scroll ---------- */
    var revealTargets = document.querySelectorAll('.service-card, .process-grid li, .why-card, .client-logo, .about-media, .about-text, .testimonial, .faq details');
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        revealTargets.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
    }

    /* ---------- Gallery filter + lightbox ---------- */
    var grid = document.getElementById('gallery-grid');
    var chips = document.querySelectorAll('.gallery-filters .chip');
    chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
            var f = chip.getAttribute('data-filter');
            chips.forEach(function (c) {
                var on = c === chip;
                c.classList.toggle('is-active', on);
                c.setAttribute('aria-pressed', String(on));
            });
            grid.querySelectorAll('li').forEach(function (li) {
                li.hidden = f !== 'all' && li.getAttribute('data-cat') !== f;
            });
        });
    });

    var lb = document.getElementById('lightbox');
    var lbImg = document.getElementById('lb-img');
    var lbCap = document.getElementById('lb-cap');
    var current = 0;
    function visibleItems() { return Array.prototype.filter.call(grid.querySelectorAll('li'), function (li) { return !li.hidden; }); }
    function show(i) {
        var items = visibleItems();
        if (!items.length) return;
        current = (i + items.length) % items.length;
        var img = items[current].querySelector('img');
        lbImg.src = img.currentSrc || img.src;
        lbImg.alt = img.alt;
        lbCap.textContent = img.alt;
    }
    if (grid && lb && typeof lb.showModal === 'function') {
        grid.addEventListener('click', function (e) {
            var btn = e.target.closest('.gallery-item');
            if (!btn) return;
            show(visibleItems().indexOf(btn.parentElement));
            lb.showModal();
        });
        lb.addEventListener('click', function (e) {
            var action = e.target.getAttribute('data-lb');
            if (action === 'close' || e.target === lb) lb.close();
            else if (action === 'prev') show(current - 1);
            else if (action === 'next') show(current + 1);
        });
        lb.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowLeft') show(current - 1);
            if (e.key === 'ArrowRight') show(current + 1);
        });
    }

    /* ---------- Quote form ---------- */
    var form = document.getElementById('quote-form');
    if (!form) return;
    var out = document.getElementById('form-message');
    var loadedAt = Date.now();
    var COOLDOWN_MS = 60 * 1000;
    var EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
    var PHONE_RE = /^[+]?[0-9\s().-]{7,20}$/;

    // Removes control characters and angle brackets; the backend sanitizes again.
    function clean(value, max) {
        return String(value || '')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
            .replace(/[<>]/g, '')
            .trim()
            .slice(0, max);
    }

    function setError(field, message) {
        var wrap = field.closest('.field');
        var old = wrap.querySelector('.field-error');
        if (old) old.remove();
        field.classList.toggle('is-invalid', !!message);
        field.setAttribute('aria-invalid', message ? 'true' : 'false');
        if (message) {
            var el = document.createElement('p');
            el.className = 'field-error';
            el.id = field.id + '-error';
            el.textContent = message;
            field.setAttribute('aria-describedby', el.id);
            wrap.appendChild(el);
        } else {
            field.removeAttribute('aria-describedby');
        }
    }

    function validate(field) {
        var v = field.type === 'checkbox' ? field.checked : field.value.trim();
        var msg = '';
        if (field.required && !v) msg = field.type === 'checkbox' ? MSG.consent : MSG.required;
        else if (field.name === 'name' && v && v.length < 2) msg = MSG.name;
        else if (field.type === 'email' && v && !EMAIL_RE.test(v)) msg = MSG.email;
        else if (field.type === 'tel' && v && !PHONE_RE.test(v)) msg = MSG.phone;
        setError(field, msg);
        return !msg;
    }

    var fields = form.querySelectorAll('input:not([name="website"]), select, textarea');
    fields.forEach(function (f) {
        f.addEventListener('blur', function () { validate(f); });
        f.addEventListener('input', function () { if (f.classList.contains('is-invalid')) validate(f); });
        f.addEventListener('change', function () { if (f.type === 'checkbox') validate(f); });
    });

    function notify(type, text) {
        out.innerHTML = '';
        var div = document.createElement('div');
        div.className = 'msg msg-' + type;
        div.textContent = text; // textContent: never inject HTML
        out.appendChild(div);
    }

    function lastSent() { try { return Number(localStorage.getItem('clau_last_quote')) || 0; } catch (e) { return 0; } }
    function markSent() { try { localStorage.setItem('clau_last_quote', String(Date.now())); } catch (e) { /* ignore */ } }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = true;
        fields.forEach(function (f) { if (!validate(f)) ok = false; });
        if (!ok) { form.querySelector('.is-invalid').focus(); return; }

        // Bots: honeypot filled or form submitted too quickly. Pretend success, send nothing.
        if (form.website.value || Date.now() - loadedAt < 3000) {
            notify('success', MSG.success);
            form.reset();
            return;
        }
        if (Date.now() - lastSent() < COOLDOWN_MS) { notify('error', MSG.tooFast); return; }
        if (!FORM_ENDPOINT) { notify('error', MSG.notConfigured); return; }

        var payload = {
            name: clean(form.name.value, 100),
            email: clean(form.email.value, 150),
            phone: clean(form.phone.value, 25),
            service: clean(form.service.value, 30),
            message: clean(form.message.value, 1000),
            consent: form.consent.checked ? 'yes' : 'no',
            lang: lang,
            page: location.origin + location.pathname,
            elapsed: Date.now() - loadedAt,
            website: ''
        };

        var btn = form.querySelector('button[type="submit"]');
        var label = btn.textContent;
        btn.disabled = true;
        btn.textContent = MSG.sending;

        // text/plain avoids a CORS preflight, which Apps Script cannot answer.
        fetch(FORM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload),
            credentials: 'omit',
            redirect: 'follow'
        })
            .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
            .then(function (data) {
                if (data && data.result === 'success') {
                    notify('success', MSG.success);
                    form.reset();
                    markSent();
                } else {
                    notify('error', MSG.error);
                }
            })
            .catch(function () { notify('error', MSG.error); })
            .finally(function () { btn.disabled = false; btn.textContent = label; });
    });
})();
