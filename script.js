document.addEventListener('DOMContentLoaded', function() {
    // Configuración del menú toggle responsive
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');
    
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('show');
            menuToggle.classList.toggle('active');
        });

        // Cerrar menú al hacer clic en un enlace (móvil)
        const navLinks = document.querySelectorAll('nav ul li a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('show');
                menuToggle.classList.remove('active');
            });
        });

        // Cerrar menú al hacer clic fuera (móvil)
        document.addEventListener('click', function(event) {
            if (!menuToggle.contains(event.target) && !navMenu.contains(event.target)) {
                navMenu.classList.remove('show');
                menuToggle.classList.remove('active');
            }
        });
    }

    // Configuración del formulario de cotización
    const quoteForm = document.getElementById('quote-form');
    if (quoteForm) {
        quoteForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Mostrar indicador de carga
            const submitButton = quoteForm.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.textContent = 'Enviando...';
            submitButton.disabled = true;
            
            // Recopilar los datos del formulario
            const formData = new FormData(quoteForm);
            const data = Object.fromEntries(formData);
            
            // Crear un elemento para mensajes
            let messageEl = document.getElementById('form-message');
            if (!messageEl) {
                messageEl = document.createElement('div');
                messageEl.id = 'form-message';
                quoteForm.parentNode.insertBefore(messageEl, quoteForm.nextSibling);
            }
            
            // Limpiar mensajes anteriores
            messageEl.innerHTML = '';
            
            // Enviar datos a Google Sheets
            fetch('https://script.google.com/macros/s/AKfycbxFkXgFlGUfAVALmkDtQfR5ZlGQ8SBx6e-010a7GV09QYdRcfPN6ktocBHYGEtJtdHg/exec', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Error en la respuesta del servidor');
                }
                return response.json();
            })
            .then(result => {
                if (result.result === 'success') {
                    messageEl.innerHTML = '<div class="success-message">¡Gracias por su solicitud! Nos pondremos en contacto pronto.</div>';
                    quoteForm.reset();
                } else {
                    messageEl.innerHTML = '<div class="error-message">Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo.</div>';
                    console.error('Error del servidor:', result.error);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                messageEl.innerHTML = '<div class="error-message">No se pudo enviar su solicitud. Por favor, verifique su conexión e inténtelo nuevamente.</div>';
            })
            .finally(() => {
                // Restaurar el botón
                submitButton.textContent = originalButtonText;
                submitButton.disabled = false;
            });
        });
    }

    // Configuración de traducciones
    const translations = {
        es: {
            title: "SGM Cleaning Services - Servicios de Mantenimiento y Limpieza",
            inicio: "Inicio",
            nosotros: "Nosotros",
            servicios: "Servicios",
            ofertas: "Ofertas",
            testimonios: "Testimonios",
            cotizacion: "Cotización",
            heroTitle: "Expertos en Mantenimiento y Limpieza de Pisos",
            heroDescription: "Soluciones profesionales para todo tipo de superficies",
            heroButton: "Solicitar Cotización",
            aboutTitle: "Sobre Nosotros",
            servicesTitle: "Nuestros Servicios",
            offersTitle: "Ofertas Especiales",
            testimonialsTitle: "Lo que dicen nuestros clientes",
            quoteTitle: "Solicite una Cotización Gratuita",
            contact: {
                title: "Contacto",
                phone: "Teléfono: +1(954) 245-1566",
                email: "Email: info@sgmcleansolutions.com",
                address: "Dirección: 86 Agawam St, Lowell Massachusetts"
            },
            links: "Enlaces Rápidos",
            follow: "Síguenos",
            formPlaceholders: {
                name: "Nombre",
                email: "Correo Electrónico",
                phone: "Teléfono",
                selectService: "Seleccione un servicio",
                additionalDetails: "Detalles adicionales",
                submit: "Enviar Solicitud"
            },
            serviceOptions: {
                oficinas: "Limpieza de Oficinas",
                pisos: "Limpieza Especializada de Pisos",
                condominios: "Apartamentos y Condominios",
                residencial: "Limpieza Residencial",
                comercial: "Limpieza Comercial",
                nieve: "Limpieza de Nieve"
            },
            formMessages: {
                sending: "Enviando...",
                success: "¡Gracias por su solicitud! Nos pondremos en contacto pronto.",
                error: "Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo.",
                connectionError: "No se pudo enviar su solicitud. Por favor, verifique su conexión e inténtelo nuevamente."
            }
        },
        en: {
            title: "SGM Clean Solutions - Floor Maintenance and Cleaning Services",
            inicio: "Home",
            nosotros: "About Us",
            servicios: "Services",
            ofertas: "Offers",
            testimonios: "Testimonials",
            cotizacion: "Quote",
            heroTitle: "Experts in Floor Maintenance and Cleaning",
            heroDescription: "Professional solutions for all surfaces",
            heroButton: "Request a Quote",
            aboutTitle: "About Us",
            servicesTitle: "Our Services",
            offersTitle: "Special Offers",
            testimonialsTitle: "What Our Clients Say",
            quoteTitle: "Request a Free Quote",
            contact: {
                title: "Contact",
                phone: "Phone: +1(954) 245-1566",
                email: "Email: info@sgmcleansolutions.com",
                address: "Address: 86 Agawam St, Lowell Massachusetts"
            },
            links: "Quick Links",
            follow: "Follow Us",
            formPlaceholders: {
                name: "Name",
                email: "Email",
                phone: "Phone",
                selectService: "Select a service",
                additionalDetails: "Additional details",
                submit: "Submit Request"
            },
            serviceOptions: {
                oficinas: "Office Cleaning",
                pisos: "Specialized Floor Cleaning",
                condominios: "Apartments and Condominiums",
                residencial: "Residential Cleaning",
                comercial: "Commercial Cleaning",
                nieve: "Snow Cleaning"
            },
            formMessages: {
                sending: "Sending...",
                success: "Thank you for your request! We will contact you soon.",
                error: "There was an error processing your request. Please try again.",
                connectionError: "Could not send your request. Please check your connection and try again."
            }
        }
    };

    // Función para actualizar contenido según idioma
    const updateContent = (lang) => {
        const content = translations[lang];
        
        // Actualizar título de la página
        document.title = content.title;
        
        // Actualizar navegación
        const navLinks = {
            inicio: document.querySelector('a[href="#inicio"]'),
            nosotros: document.querySelector('a[href="#about-us"]'),
            servicios: document.querySelector('a[href="#servicios"]'),
            ofertas: document.querySelector('a[href="#ofertas"]'),
            testimonios: document.querySelector('a[href="#testimonios"]'),
            cotizacion: document.querySelector('a[href="#cotizacion"]')
        };

        if (navLinks.inicio) navLinks.inicio.textContent = content.inicio;
        if (navLinks.nosotros) navLinks.nosotros.textContent = content.nosotros;
        if (navLinks.servicios) navLinks.servicios.textContent = content.servicios;
        if (navLinks.ofertas) navLinks.ofertas.textContent = content.ofertas;
        if (navLinks.testimonios) navLinks.testimonios.textContent = content.testimonios;
        if (navLinks.cotizacion) navLinks.cotizacion.textContent = content.cotizacion;

        // Actualizar hero section
        const heroTitle = document.querySelector('#hero h1');
        const heroDesc = document.querySelector('#hero p');
        const ctaButton = document.querySelector('.cta-button');
        
        if (heroTitle) heroTitle.textContent = content.heroTitle;
        if (heroDesc) heroDesc.textContent = content.heroDescription;
        if (ctaButton) ctaButton.textContent = content.heroButton;

        // Actualizar títulos de secciones
        const aboutTitle = document.querySelector('#about-us h2');
        if (aboutTitle) aboutTitle.textContent = content.aboutTitle;

        const servicesTitle = document.querySelector('#servicios h2');
        if (servicesTitle) servicesTitle.textContent = content.servicesTitle;

        const offersTitle = document.querySelector('#ofertas h2');
        if (offersTitle) offersTitle.textContent = content.offersTitle;

        const testimonialsTitle = document.querySelector('#testimonios h2');
        if (testimonialsTitle) testimonialsTitle.textContent = content.testimonialsTitle;

        const quoteTitle = document.querySelector('#cotizacion h2');
        if (quoteTitle) quoteTitle.textContent = content.quoteTitle;

        // Actualizar formulario
        const form = document.querySelector('#quote-form');
        if (form) {
            const nameInput = form.querySelector('input[name="name"]');
            const emailInput = form.querySelector('input[name="email"]');
            const phoneInput = form.querySelector('input[name="phone"]');
            const messageTextarea = form.querySelector('textarea[name="message"]');
            const submitBtn = form.querySelector('button[type="submit"]');
            
            if (nameInput) nameInput.setAttribute('placeholder', content.formPlaceholders.name);
            if (emailInput) emailInput.setAttribute('placeholder', content.formPlaceholders.email);
            if (phoneInput) phoneInput.setAttribute('placeholder', content.formPlaceholders.phone);
            if (messageTextarea) messageTextarea.setAttribute('placeholder', content.formPlaceholders.additionalDetails);
            if (submitBtn) submitBtn.textContent = content.formPlaceholders.submit;
            
            // Actualizar opciones del select
            const selectService = form.querySelector('select[name="service"]');
            if (selectService) {
                const options = selectService.querySelectorAll('option');
                options[0].textContent = content.formPlaceholders.selectService; // Primera opción vacía
                
                // Actualizar opciones de servicios
                Object.keys(content.serviceOptions).forEach((key, index) => {
                    if (options[index + 1]) {
                        options[index + 1].textContent = content.serviceOptions[key];
                    }
                });
            }
        }

        // Actualizar footer
        const footerSections = document.querySelectorAll('.footer-section h3');
        if (footerSections.length >= 3) {
            footerSections[0].textContent = content.contact.title;
            footerSections[1].textContent = content.links;
            footerSections[2].textContent = content.follow;
        }

        // Actualizar información de contacto en footer
        const footerPhone = document.getElementById('footer-phone');
        const footerEmail = document.getElementById('footer-email');
        const footerAddress = document.getElementById('footer-address');
        
        if (footerPhone) footerPhone.textContent = content.contact.phone;
        if (footerEmail) footerEmail.textContent = content.contact.email;
        if (footerAddress) footerAddress.textContent = content.contact.address;
    };

    // Configurar selector de idioma
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        languageSelector.addEventListener('change', function(e) {
            const lang = e.target.value;
            updateContent(lang);
            // Guardar la preferencia de idioma
            localStorage.setItem('selectedLanguage', lang);
        });
        
        // Cargar idioma guardado o usar español por defecto
        const savedLanguage = localStorage.getItem('selectedLanguage') || 'es';
        languageSelector.value = savedLanguage;
        updateContent(savedLanguage);
    } else {
        // Si no hay selector, usar español por defecto
        updateContent('en');
    }

    // Scroll suave para los enlaces de navegación
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
    smoothScrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            
            // Manejar el enlace de inicio
            if (targetId === '#inicio') {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
                return;
            }
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const offsetTop = targetElement.getBoundingClientRect().top + window.pageYOffset;
                const headerHeight = document.querySelector('header').offsetHeight;
                
                window.scrollTo({
                    top: offsetTop - headerHeight - 20,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Animación de entrada para elementos cuando aparecen en viewport
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);

    // Observar elementos animables
    const animatedElements = document.querySelectorAll('.service-item, .offer-item, .testimonial-item, .about-text, .about-image');
    animatedElements.forEach(el => {
        observer.observe(el);
    });

    // Funcionalidad del slider de ofertas
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

        offerSlider.addEventListener('mouseleave', () => {
            isDown = false;
            offerSlider.classList.remove('active');
        });

        offerSlider.addEventListener('mouseup', () => {
            isDown = false;
            offerSlider.classList.remove('active');
        });

        offerSlider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - offerSlider.offsetLeft;
            const walk = (x - startX) * 2;
            offerSlider.scrollLeft = scrollLeft - walk;
        });
    }

    // Validación adicional del formulario
    const inputs = document.querySelectorAll('#quote-form input, #quote-form select, #quote-form textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });

        input.addEventListener('input', function() {
            if (this.classList.contains('error')) {
                validateField(this);
            }
        });
    });

    function validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Limpiar mensajes de error anteriores
        field.classList.remove('error');
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }

        // Validaciones específicas
        switch (field.type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (value && !emailRegex.test(value)) {
                    isValid = false;
                    errorMessage = 'Por favor, ingrese un email válido';
                }
                break;
            case 'tel':
                const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
                if (value && !phoneRegex.test(value)) {
                    isValid = false;
                    errorMessage = 'Por favor, ingrese un teléfono válido';
                }
                break;
        }

        // Validación de campos requeridos
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'Este campo es obligatorio';
        }

        // Mostrar error si no es válido
        if (!isValid) {
            field.classList.add('error');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.textContent = errorMessage;
            field.parentNode.insertBefore(errorDiv, field.nextSibling);
        }

        return isValid;
    }

    // Efecto de header transparente al hacer scroll
    let lastScrollTop = 0;
    const header = document.querySelector('header');
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        // Ocultar/mostrar header en scroll
        if (scrollTop > lastScrollTop && scrollTop > 200) {
            header.style.transform = 'translateY(-100%)';
        } else {
            header.style.transform = 'translateY(0)';
        }
        
        lastScrollTop = scrollTop;
    });

    // Lazy loading para imágenes
    const images = document.querySelectorAll('img[src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.src; // Trigger loading
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    });

    images.forEach(img => {
        imageObserver.observe(img);
    });

    // Manejar errores de carga de video
    const heroVideo = document.querySelector('.hero-video');
    if (heroVideo) {
        heroVideo.addEventListener('error', function() {
            console.warn('Error loading hero video');
            // Fallback: mostrar imagen de fondo
            const hero = document.querySelector('#hero');
            hero.style.backgroundImage = 'url(assets/hero-fallback.jpg)';
            hero.style.backgroundSize = 'cover';
            hero.style.backgroundPosition = 'center';
        });
    }

    // Función para reportar errores de JavaScript
    window.addEventListener('error', function(e) {
        console.error('JavaScript Error:', e.error);
        // Aquí podrías enviar el error a un servicio de monitoreo
    });

    // Performance: Precargar recursos críticos
    const criticalResources = [
        'assets/logo.png',
        'assets/aboutUs.jpg'
    ];

    criticalResources.forEach(resource => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource;
        link.as = 'image';
        document.head.appendChild(link);
    });

    console.log('SGM Cleaning Services - Script loaded successfully');
});
