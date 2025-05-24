document.addEventListener('DOMContentLoaded', function() {
    const quoteForm = document.getElementById('quote-form');
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

    const updateContent = (lang) => {
        const content = translations[lang];
        
        // Actualizar textos de la interfaz según el idioma seleccionado
        document.title = content.title;
        document.querySelector('a[href="#inicio"]').textContent = content.inicio;
        document.querySelector('a[href="#servicios"]').textContent = content.servicios;
        document.querySelector('a[href="#ofertas"]').textContent = content.ofertas;
        document.querySelector('a[href="#testimonios"]').textContent = content.testimonios;
        document.querySelector('a[href="#cotizacion"]').textContent = content.cotizacion;
        document.querySelector('a[href="#about-us"]').textContent = content.nosotros;

        document.querySelector('#hero h1').textContent = content.heroTitle;
        document.querySelector('#hero p').textContent = content.heroDescription;
        document.querySelector('.cta-button').textContent = content.heroButton;

        document.querySelector('#servicios h2').textContent = content.sectionServicesTitle;
        const serviceItems = document.querySelectorAll('.service-item');
        content.services.forEach((service, index) => {
            serviceItems[index].querySelector('h3').textContent = service.title;
            serviceItems[index].querySelector('p').textContent = service.description;
        });

        document.querySelector('#ofertas h2').textContent = content.offersTitle;
        const offerItems = document.querySelectorAll('.offer-item');
        content.offers.forEach((offer, index) => {
            offerItems[index].querySelector('h3').textContent = offer.title;
            offerItems[index].querySelector('p').textContent = offer.description;
        });

        document.querySelector('#testimonios h2').textContent = content.testimonialsTitle;

        document.querySelector('.footer-section h3').textContent = content.contact.title;
        const contactDetails = document.querySelectorAll('.footer-section p');
        contactDetails[0].textContent = content.contact.phone;
        contactDetails[1].textContent = content.contact.email;
        contactDetails[2].textContent = content.contact.address;

        const footerLinks = document.querySelectorAll('.footer-section h3')[1];
        footerLinks.textContent = content.links;

        document.querySelector('#cotizacion h2').textContent = content.requestQuote;
        const quoteForm = document.querySelector('#quote-form');
        quoteForm.querySelectorAll('input, textarea').forEach(input => {
            if (input.getAttribute('placeholder')) {
                input.setAttribute('placeholder', content.formPlaceholders[input.name]);
            }
        });
        quoteForm.querySelector('button').textContent = content.formPlaceholders.submit;
        
        const selectService = quoteForm.querySelector('select');
        selectService.querySelector('option').textContent = content.formPlaceholders.selectService;
    };

    const languageSelector = document.getElementById('language-selector');
    languageSelector.addEventListener('change', function(e) {
        const lang = e.target.value;
        updateContent(lang);
    });

    // Set default content to Spanish on load
    updateContent('es');

        // Añadir logo de WhatsApp al botón flotante (si existe)
   /* const whatsappBtn = document.querySelector('.whatsapp-button');
    if (whatsappBtn) {
        whatsappBtn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp">';
        whatsappBtn.style.position = 'fixed';
        whatsappBtn.style.bottom = '20px';
        whatsappBtn.style.right = '20px';
        whatsappBtn.style.zIndex = '5000';
    }*/
    const menuToggle = document.getElementById('menu-toggle');
    const navUl = document.querySelector('nav ul');
    if (menuToggle && navUl) {
        menuToggle.addEventListener('click', () => {
            navUl.classList.toggle('show');
        });
    }

});
