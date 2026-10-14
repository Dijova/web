/*
 * UI translations. English is the default language of the site (the HTML is
 * written in English); Spanish is applied on demand from the language selector.
 *
 * Keys are referenced from index.html through data-i18n* attributes:
 *   data-i18n="key"              -> textContent
 *   data-i18n-html="key"         -> innerHTML (only for trusted strings below)
 *   data-i18n-placeholder="key"  -> placeholder attribute
 *   data-i18n-alt="key"          -> alt attribute
 *   data-i18n-aria-label="key"   -> aria-label attribute
 *   data-i18n-content="key"      -> content attribute (meta tags)
 */
window.SGM_TRANSLATIONS = {
    en: {
        pageTitle: 'SGM Clean Solutions - Floor Maintenance and Cleaning Services',
        metaDescription: 'SGM Clean Solutions: professional floor maintenance, commercial, residential and snow cleaning services in Lowell, Massachusetts.',
        logoAlt: 'SGM Clean Solutions logo',
        menuToggle: 'Open menu',
        languageLabel: 'Language',
        nav: {
            home: 'Home',
            about: 'About Us',
            services: 'Services',
            offers: 'Offers',
            testimonials: 'Testimonials',
            quote: 'Quote'
        },
        hero: {
            videoFallback: 'Your browser does not support HTML5 video.',
            title: 'Experts in Floor Maintenance and Cleaning',
            subtitle: 'Professional solutions for every type of surface',
            cta: 'Request a Quote'
        },
        about: {
            title: 'About Us',
            p1: 'At <strong>SGM Clean Solutions</strong> we are dedicated to offering high-quality cleaning and maintenance solutions for both residential and commercial spaces. Our commitment is excellence and sustainability.',
            p2: 'We use <strong>cutting-edge technology</strong> and certified products that ensure impeccable results and a healthier environment for our clients.',
            item1: '✅ Professional and trained team',
            item2: '✅ Personalized services',
            item3: '✅ Ecological commitment',
            imageAlt: 'Our professional cleaning team'
        },
        services: {
            title: 'Our Services',
            office: {
                alt: 'Office cleaning',
                title: 'Office Cleaning Service',
                i1: '🫧 Daily Cleaning',
                i2: '🫧 Deep Disinfection',
                i3: '🫧 Customized Solutions'
            },
            floors: {
                alt: 'Specialized floor cleaning',
                title: 'Specialized Floor Cleaning',
                i1: '🫧 Stripping and Waxing',
                i2: '🫧 Deep Carpet Cleaning',
                i3: '🫧 Surface Care and Maintenance'
            },
            condos: {
                alt: 'Apartment and condominium solutions',
                title: 'Apartment and Condominium Solutions',
                i1: '🫧 Apartment Cleaning',
                i2: '🫧 Common Areas Maintenance',
                i3: '🫧 Recreational Areas Maintenance'
            },
            residential: {
                alt: 'Residential cleaning',
                title: 'Residential Cleaning',
                i1: '🫧 Regular Cleaning',
                i2: '🫧 Deep Cleaning',
                i3: '🫧 Post-Construction or Post-Move Cleaning'
            },
            commercial: {
                alt: 'Commercial cleaning',
                title: 'Commercial Cleaning',
                i1: '🫧 Office Cleaning',
                i2: '🫧 Industrial Cleaning',
                i3: '🫧 Commercial Space Maintenance'
            },
            snow: {
                alt: 'Snow removal',
                title: 'Snow Removal',
                i1: '🫧 Roof & Gutter Snow Removal',
                i2: '🫧 Ice Melt & Anti-Slip Treatment',
                i3: '🫧 Driveway & Sidewalk Snow Removal'
            }
        },
        offers: {
            title: 'Special Offers',
            o1: { title: '5% off your first cleaning', text: 'Valid for new residential service clients' },
            o2: { title: 'Quarterly maintenance package', text: 'Save 10% by subscribing to our quarterly plan' },
            o3: { title: 'Post-construction cleaning + free sealing', text: 'Limited time only for projects over 100 m²' }
        },
        testimonials: {
            title: 'What Our Clients Say',
            t1: { text: '"Excellent service, they left my floors looking like new. Highly recommended."', author: '- María G., Residential Client' },
            t2: { text: '"SGM Clean Solutions transformed the look of our office. Professional and efficient."', author: '- Juan R., Office Manager' },
            t3: { text: '"Their post-construction cleaning exceeded our expectations. We will hire them again."', author: '- Carlos M., Builder' }
        },
        quote: {
            title: 'Request a Free Quote'
        },
        form: {
            name: 'Full name',
            email: 'Email',
            phone: 'Phone (optional)',
            service: 'Service',
            selectService: 'Select a service',
            services: {
                office: 'Office Cleaning',
                floors: 'Specialized Floor Cleaning',
                condos: 'Apartments and Condominiums',
                residential: 'Residential Cleaning',
                commercial: 'Commercial Cleaning',
                snow: 'Snow Removal'
            },
            message: 'Additional details',
            consent: 'I agree that SGM Clean Solutions may store my information to respond to this quote request.',
            submit: 'Submit Request',
            sending: 'Sending...',
            privacyNote: '🔒 Your information is sent over an encrypted connection and used only to answer your request. We will never ask for passwords, bank details or payments through email or this form.',
            success: 'Thank you for your request! We will contact you soon.',
            error: 'There was an error processing your request. Please try again.',
            connectionError: 'Could not send your request. Please check your connection and try again.',
            rateLimited: 'Too many requests. Please wait a few minutes and try again.',
            tooFast: 'Please take a moment to review your information and try again.',
            captcha: 'Please complete the security check.',
            fixErrors: 'Please correct the highlighted fields.',
            errors: {
                required: 'This field is required',
                name: 'Please enter a valid name (letters only, 2-100 characters)',
                email: 'Please enter a valid email address',
                phone: 'Please enter a valid phone number',
                message: 'Please do not include links or HTML in the message',
                consent: 'You must accept to continue'
            }
        },
        footer: {
            contact: 'Contact',
            phone: 'Phone:',
            email: 'Email:',
            address: 'Address:',
            links: 'Quick Links',
            follow: 'Follow Us',
            rights: 'All rights reserved.'
        }
    },

    es: {
        pageTitle: 'SGM Clean Solutions - Servicios de Mantenimiento y Limpieza de Pisos',
        metaDescription: 'SGM Clean Solutions: servicios profesionales de mantenimiento de pisos, limpieza comercial, residencial y remoción de nieve en Lowell, Massachusetts.',
        logoAlt: 'Logo de SGM Clean Solutions',
        menuToggle: 'Abrir menú',
        languageLabel: 'Idioma',
        nav: {
            home: 'Inicio',
            about: 'Nosotros',
            services: 'Servicios',
            offers: 'Ofertas',
            testimonials: 'Testimonios',
            quote: 'Cotización'
        },
        hero: {
            videoFallback: 'Tu navegador no soporta video HTML5.',
            title: 'Expertos en Mantenimiento y Limpieza de Pisos',
            subtitle: 'Soluciones profesionales para todo tipo de superficies',
            cta: 'Solicitar Cotización'
        },
        about: {
            title: 'Sobre Nosotros',
            p1: 'En <strong>SGM Clean Solutions</strong> nos dedicamos a ofrecer soluciones de limpieza y mantenimiento de alta calidad para espacios residenciales y comerciales. Nuestro compromiso es la excelencia y la sostenibilidad.',
            p2: 'Utilizamos <strong>tecnología de vanguardia</strong> y productos certificados que garantizan resultados impecables y un ambiente más saludable para nuestros clientes.',
            item1: '✅ Equipo profesional y capacitado',
            item2: '✅ Servicios personalizados',
            item3: '✅ Compromiso ecológico',
            imageAlt: 'Nuestro equipo profesional de limpieza'
        },
        services: {
            title: 'Nuestros Servicios',
            office: {
                alt: 'Limpieza de oficinas',
                title: 'Servicio de Limpieza de Oficinas',
                i1: '🫧 Limpieza diaria',
                i2: '🫧 Desinfección profunda',
                i3: '🫧 Soluciones personalizadas'
            },
            floors: {
                alt: 'Limpieza especializada de pisos',
                title: 'Limpieza Especializada de Pisos',
                i1: '🫧 Decapado y encerado',
                i2: '🫧 Limpieza profunda de alfombras',
                i3: '🫧 Cuidado y mantenimiento de superficies'
            },
            condos: {
                alt: 'Soluciones para apartamentos y condominios',
                title: 'Soluciones para Apartamentos y Condominios',
                i1: '🫧 Limpieza de apartamentos',
                i2: '🫧 Mantenimiento de áreas comunes',
                i3: '🫧 Mantenimiento de áreas recreativas'
            },
            residential: {
                alt: 'Limpieza residencial',
                title: 'Limpieza Residencial',
                i1: '🫧 Limpieza regular',
                i2: '🫧 Limpieza profunda',
                i3: '🫧 Limpieza post-construcción o post-mudanza'
            },
            commercial: {
                alt: 'Limpieza comercial',
                title: 'Limpieza Comercial',
                i1: '🫧 Limpieza de oficinas',
                i2: '🫧 Limpieza industrial',
                i3: '🫧 Mantenimiento de espacios comerciales'
            },
            snow: {
                alt: 'Remoción de nieve',
                title: 'Remoción de Nieve',
                i1: '🫧 Remoción de nieve en techos y canaletas',
                i2: '🫧 Derretido de hielo y tratamiento antideslizante',
                i3: '🫧 Remoción de nieve en entradas y aceras'
            }
        },
        offers: {
            title: 'Ofertas Especiales',
            o1: { title: '5% de descuento en tu primera limpieza', text: 'Válido para nuevos clientes de servicio residencial' },
            o2: { title: 'Paquete de mantenimiento trimestral', text: 'Ahorra 10% suscribiéndote a nuestro plan trimestral' },
            o3: { title: 'Limpieza post-construcción + sellado gratis', text: 'Por tiempo limitado para proyectos de más de 100 m²' }
        },
        testimonials: {
            title: 'Lo que dicen nuestros clientes',
            t1: { text: '"Excelente servicio, dejaron mis pisos como nuevos. Muy recomendados."', author: '- María G., Cliente residencial' },
            t2: { text: '"SGM Clean Solutions transformó la imagen de nuestra oficina. Profesionales y eficientes."', author: '- Juan R., Gerente de oficina' },
            t3: { text: '"Su limpieza post-construcción superó nuestras expectativas. Los volveremos a contratar."', author: '- Carlos M., Constructor' }
        },
        quote: {
            title: 'Solicite una Cotización Gratuita'
        },
        form: {
            name: 'Nombre completo',
            email: 'Correo electrónico',
            phone: 'Teléfono (opcional)',
            service: 'Servicio',
            selectService: 'Seleccione un servicio',
            services: {
                office: 'Limpieza de Oficinas',
                floors: 'Limpieza Especializada de Pisos',
                condos: 'Apartamentos y Condominios',
                residential: 'Limpieza Residencial',
                commercial: 'Limpieza Comercial',
                snow: 'Remoción de Nieve'
            },
            message: 'Detalles adicionales',
            consent: 'Acepto que SGM Clean Solutions almacene mis datos para responder a esta solicitud de cotización.',
            submit: 'Enviar Solicitud',
            sending: 'Enviando...',
            privacyNote: '🔒 Tu información se envía por una conexión cifrada y se usa solo para responder a tu solicitud. Nunca te pediremos contraseñas, datos bancarios ni pagos por correo o por este formulario.',
            success: '¡Gracias por su solicitud! Nos pondremos en contacto pronto.',
            error: 'Hubo un error al procesar su solicitud. Por favor, inténtelo de nuevo.',
            connectionError: 'No se pudo enviar su solicitud. Por favor, verifique su conexión e inténtelo nuevamente.',
            rateLimited: 'Demasiadas solicitudes. Por favor espere unos minutos e inténtelo de nuevo.',
            tooFast: 'Por favor tómese un momento para revisar su información e inténtelo de nuevo.',
            captcha: 'Por favor complete la verificación de seguridad.',
            fixErrors: 'Por favor corrija los campos marcados.',
            errors: {
                required: 'Este campo es obligatorio',
                name: 'Ingrese un nombre válido (solo letras, 2-100 caracteres)',
                email: 'Por favor, ingrese un correo electrónico válido',
                phone: 'Por favor, ingrese un teléfono válido',
                message: 'Por favor no incluya enlaces ni HTML en el mensaje',
                consent: 'Debe aceptar para continuar'
            }
        },
        footer: {
            contact: 'Contacto',
            phone: 'Teléfono:',
            email: 'Correo:',
            address: 'Dirección:',
            links: 'Enlaces Rápidos',
            follow: 'Síguenos',
            rights: 'Todos los derechos reservados.'
        }
    }
};
