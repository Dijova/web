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
            title: "CleanFloor Pro - Servicios de Mantenimiento y Limpieza de Pisos",
            inicio: "Inicio",
            servicios: "Servicios",
            ofertas: "Ofertas",
            testimonios: "Testimonios",
            cotizacion: "Cotización",
            heroTitle: "Expertos en Mantenimiento y Limpieza de Pisos",
            heroDescription: "Soluciones profesionales para todo tipo de superficies",
            heroButton: "Solicitar Cotización",
            sectionServicesTitle: "Nuestros Servicios",
            nosotros: "Sobre Nosotros",
            services: [
                {
                    title: "Mantenimiento Especializado",
                    description: "Cuidado experto para todo tipo de pisos"
                },
                {
                    title: "Limpieza Profesional",
                    description: "Dejamos sus pisos impecables y relucientes"
                },
                {
                    title: "Aplicación de Pisos en Resina",
                    description: "Soluciones duraderas y estéticas"
                },
                {
                    title: "Limpieza Residencial",
                    description: "Cuidamos de su hogar como si fuera el nuestro"
                },
                {
                    title: "Limpieza Comercial",
                    description: "Mantenemos su negocio impecable"
                },
                {
                    title: "Limpieza Post Construcción",
                    description: "Dejamos su espacio listo para estrenar"
                }
            ],
            offersTitle: "Ofertas Especiales",
            offers: [
                {
                    title: "20% de descuento en su primera limpieza",
                    description: "Válido para nuevos clientes en servicios residenciales"
                },
                {
                    title: "Paquete de mantenimiento trimestral",
                    description: "Ahorre un 15% al contratar nuestro plan trimestral"
                },
                {
                    title: "Limpieza post construcción + sellado gratis",
                    description: "Por tiempo limitado en proyectos mayores a 100m²"
                }
            ],
            testimonialsTitle: "Lo que dicen nuestros clientes",
            contact: {
                title: "Contacto",
                phone: "Teléfono: (123) 456-7890",
                email: "Email: info@cleanfloorpro.com",
                address: "Dirección: 123 Calle Principal, Ciudad"
            },
            links: "Enlaces Rápidos",
            requestQuote: "Solicite una Cotización Gratuita",
            formPlaceholders: {
                name: "Nombre",
                email: "Correo Electrónico",
                phone: "Teléfono",
                selectService: "Seleccione un servicio",
                additionalDetails: "Detalles adicionales",
                submit: "Enviar Solicitud"
            },
            formMessages: {
                sending: "Enviando...",
                success: "¡Gracias por su solicitud! Nos pondremos en contacto pronto.",
                error: "Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo.",
                connectionError: "No se pudo enviar su solicitud. Por favor, verifique su conexión e inténtelo nuevamente."
            }
        },
        en: {
            title: "CleanFloor Pro - Floor Maintenance and Cleaning Services",
            inicio: "Home",
            servicios: "Services",
            ofertas: "Offers",
            testimonios: "Testimonials",
            cotizacion: "Quote",
            heroTitle: "Experts in Floor Maintenance and Cleaning",
            heroDescription: "Professional solutions for all surfaces",
            heroButton: "Request a Quote",
            sectionServicesTitle: "Our Services",
            nosotros: "About Us",
            services: [
                {
                    title: "Specialized Maintenance",
                    description: "Expert care for all floor types"
                },
                {
                    title: "Professional Cleaning",
                    description: "We make your floors shine and sparkle"
                },
                {
                    title: "Resin Floor Application",
                    description: "Durable and aesthetic solutions"
                },
                {
                    title: "Residential Cleaning",
                    description: "We care for your home as if it were ours"
                },
                {
                    title: "Commercial Cleaning",
                    description: "Keeping your business spotless"
                },
                {
                    title: "Post-Construction Cleaning",
                    description: "We leave your space ready to showcase"
                }
            ],
            offersTitle: "Special Offers",
            offers: [
                {
                    title: "20% off your first cleaning",
                    description: "Valid for new residential service clients"
                },
                {
                    title: "Quarterly maintenance package",
                    description: "Save 15% by subscribing to our quarterly plan"
                },
                {
                    title: "Post-construction cleaning + free sealing",
                    description: "Limited time only for projects over 100m²"
                }
            ],
            testimonialsTitle: "What Our Clients Say",
            contact: {
                title: "Contact",
                phone: "Phone: (123) 456-7890",
                email: "Email: info@cleanfloorpro.com",
                address: "Address: 123 Main Street, City"
            },
            links: "Quick Links",
            requestQuote: "Request a Free Quote",
            formPlaceholders: {
                name: "Name",
                email: "Email",
                phone: "Phone",
                selectService: "Select a service",
                additionalDetails: "Additional details",
                submit: "Submit Request"
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
        
        // Actualizar textos de la interfaz según el idioma seleccionado
        document.title = content.title;
        
        // Actualizar navegación
        const navLinks = {
            inicio: document.querySelector('a[href="#inicio"]'),
            servicios: document.querySelector('a[href="#servicios"]'),
            ofertas: document.querySelector('a[href="#ofertas"]'),
            testimonios: document.querySelector('a[href="#testimonios"]'),
            cotizacion: document.querySelector('a[href="#cotizacion"]'),
            nosotros: document.querySelector('a[href="#about-us"]')
        };

        if (navLinks.inicio) navLinks.inicio.textContent = content.inicio;
        if (navLinks.servicios) navLinks.servicios.textContent = content.servicios;
        if (navLinks.ofertas) navLinks.ofertas.textContent = content.ofertas;
        if (navLinks.testimonios) navLinks.testimonios.textContent = content.testimonios;
        if (navLinks.cotizacion) navLinks.cotizacion.textContent = content.cotizacion;
        if (navLinks.nosotros) navLinks.nosotros.textContent = content.nosotros;

        // Actualizar hero section
        const heroTitle = document.querySelector('#hero h1');
        const heroDesc = document.querySelector('#hero p');
        const ctaButton = document.querySelector('.cta-button');
        
        if (heroTitle) heroTitle.textContent = content.heroTitle;
        if (heroDesc) heroDesc.textContent = content.heroDescription;
        if (ctaButton) ctaButton.textContent = content.heroButton;

        // Actualizar servicios
        const servicesTitle = document.querySelector('#servicios h2');
        if (servicesTitle) servicesTitle.textContent = content.sectionServicesTitle;
        
        const serviceItems = document.querySelectorAll('.service-item');
        content.services.forEach((service, index) => {
            if (serviceItems[index]) {
                const serviceTitle = serviceItems[index].querySelector('h3');
                const serviceDesc = serviceItems[index].querySelector('p');
                if (serviceTitle) serviceTitle.textContent = service.title;
                if (serviceDesc) serviceDesc.textContent = service.description;
            }
        });

        // Actualizar ofertas
        const offersTitle = document.querySelector('#ofertas h2');
        if (offersTitle) offersTitle.textContent = content.offersTitle;
        
        const offerItems = document.querySelectorAll('.offer-item');
        content.offers.forEach((offer, index) => {
            if (offerItems[index]) {
                const offerTitle = offerItems[index].querySelector('h3');
                const offerDesc = offerItems[index].querySelector('p');
                if (offerTitle) offerTitle.textContent = offer.title;
                if (offerDesc) offerDesc.textContent = offer.description;
            }
        });

        // Actualizar testimonios
        const testimonialsTitle = document.querySelector('#testimonios h2');
        if (testimonialsTitle) testimonialsTitle.textContent = content.testimonialsTitle;

        // Actualizar cotización
        const quoteTitle = document.querySelector('#cotizacion h2');
        if (quoteTitle) quoteTitle.textContent = content.requestQuote;
        
        const form = document.querySelector('#quote-form');
        if (form) {
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                const fieldName = input.getAttribute('name');
                if (fieldName && content.formPlaceholders[fieldName]) {
                    input.setAttribute('placeholder', content.formPlaceholders[fieldName]);
                }
            });
            
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = content.formPlaceholders.submit;
            
            const selectService = form.querySelector('select');
            if (selectService) {
                const firstOption = selectService.querySelector('option[value=""]');
                if (firstOption) firstOption.textContent = content.formPlaceholders.selectService;
            }
        }

        // Actualizar footer si existe
        const footerSections = document.querySelectorAll('.footer-section h3');
        if (footerSections.length > 0) {
            footerSections[0].textContent = content.contact.title;
            if (footerSections.length > 1) {
                footerSections[1].textContent = content.links;
            }
        }

        const contactDetails = document.querySelectorAll('.footer-section p');
        if (contactDetails.length >= 3) {
            contactDetails[0].textContent = content.contact.phone;
            contactDetails[1].textContent = content.contact.email;
            contactDetails[2].textContent = content.contact.address;
        }
    };

    // Configurar selector de idioma
    const languageSelector = document.getElementById('language-selector');
    if (languageSelector) {
        languageSelector.addEventListener('change', function(e) {
            const lang = e.target.value;
            updateContent(lang);
        });
    }

    // Establecer contenido por defecto en español
    updateContent('es');

    // Scroll suave para los enlaces de navegación
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
    smoothScrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                const headerHeight = document.querySelector('header').offsetHeight;
                const targetPosition = targetSection.offsetTop - headerHeight;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});
