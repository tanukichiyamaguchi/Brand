/**
 * KATE stage LASH - Luxury Salon Website
 * Main JavaScript File
 */

(function() {
    'use strict';

    // ==============================================
    // DOM Elements
    // ==============================================
    const preloader = document.getElementById('preloader');
    const header = document.getElementById('header');
    const hamburger = document.getElementById('hamburger');
    const nav = document.getElementById('nav');
    const navLinks = document.querySelectorAll('.nav-link');
    const heroVideo = document.querySelector('.hero-video');

    // ==============================================
    // Preloader
    // ==============================================
    function initPreloader() {
        window.addEventListener('load', () => {
            setTimeout(() => {
                preloader.classList.add('hidden');
                document.body.classList.remove('no-scroll');

                // Trigger hero animations after preloader
                setTimeout(() => {
                    initAOS();
                }, 200);
            }, 1800);
        });
    }

    // ==============================================
    // Header Scroll Effect
    // ==============================================
    function initHeaderScroll() {
        let lastScroll = 0;
        const scrollThreshold = 100;

        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;

            if (currentScroll > scrollThreshold) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }

            lastScroll = currentScroll;
        }, { passive: true });
    }

    // ==============================================
    // Mobile Navigation
    // ==============================================
    function initMobileNav() {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            nav.classList.toggle('active');
            document.body.classList.toggle('no-scroll');
        });

        // Close nav when clicking on links
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                nav.classList.remove('active');
                document.body.classList.remove('no-scroll');
            });
        });

        // Close nav on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && nav.classList.contains('active')) {
                hamburger.classList.remove('active');
                nav.classList.remove('active');
                document.body.classList.remove('no-scroll');
            }
        });
    }

    // ==============================================
    // Smooth Scroll
    // ==============================================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');

                if (href === '#') return;

                e.preventDefault();

                const target = document.querySelector(href);
                if (target) {
                    const headerHeight = header.offsetHeight;
                    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // ==============================================
    // AOS (Animate on Scroll) - Custom Implementation
    // ==============================================
    function initAOS() {
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = entry.target.getAttribute('data-aos-delay') || 0;
                    setTimeout(() => {
                        entry.target.classList.add('aos-animate');
                    }, parseInt(delay));
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        document.querySelectorAll('[data-aos]').forEach(el => {
            observer.observe(el);
        });
    }

    // ==============================================
    // Video Background Fallback
    // ==============================================
    function initVideoBackground() {
        if (heroVideo) {
            // Add loading state
            heroVideo.addEventListener('loadstart', () => {
                heroVideo.parentElement.classList.add('loading');
            });

            // Remove loading state when video can play
            heroVideo.addEventListener('canplay', () => {
                heroVideo.parentElement.classList.remove('loading');
            });

            // Handle video errors
            heroVideo.addEventListener('error', () => {
                console.log('Video could not be loaded. Using fallback.');
                heroVideo.parentElement.classList.add('video-error');
            });

            // Pause video when not in viewport for performance
            const videoObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        heroVideo.play().catch(() => {
                            // Autoplay might be blocked
                            console.log('Autoplay prevented');
                        });
                    } else {
                        heroVideo.pause();
                    }
                });
            }, { threshold: 0.1 });

            videoObserver.observe(heroVideo);
        }
    }

    // ==============================================
    // Parallax Effect
    // ==============================================
    function initParallax() {
        const parallaxElements = document.querySelectorAll('[data-parallax]');

        if (parallaxElements.length === 0) return;

        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;

            parallaxElements.forEach(el => {
                const speed = el.getAttribute('data-parallax') || 0.5;
                const offset = scrolled * speed;
                el.style.transform = `translateY(${offset}px)`;
            });
        }, { passive: true });
    }

    // ==============================================
    // Menu Hover Effects
    // ==============================================
    function initMenuEffects() {
        const menuItems = document.querySelectorAll('.menu-item');

        menuItems.forEach(item => {
            item.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-4px)';
            });

            item.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });
    }

    // ==============================================
    // Gallery Lightbox (Basic)
    // ==============================================
    function initGallery() {
        const galleryItems = document.querySelectorAll('.gallery-item');

        galleryItems.forEach(item => {
            item.addEventListener('click', function() {
                // For future: implement lightbox
                console.log('Gallery item clicked');
            });
        });
    }

    // ==============================================
    // Button Ripple Effect
    // ==============================================
    function initButtonEffects() {
        const buttons = document.querySelectorAll('.btn');

        buttons.forEach(button => {
            button.addEventListener('click', function(e) {
                const rect = this.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const ripple = document.createElement('span');
                ripple.style.cssText = `
                    position: absolute;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    width: 100px;
                    height: 100px;
                    transform: translate(-50%, -50%) scale(0);
                    left: ${x}px;
                    top: ${y}px;
                    animation: ripple 0.6s ease-out;
                    pointer-events: none;
                `;

                this.appendChild(ripple);

                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        });

        // Add ripple animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: translate(-50%, -50%) scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ==============================================
    // Testimonials Slider (Basic)
    // ==============================================
    function initTestimonialsSlider() {
        const slider = document.querySelector('.testimonials-slider');
        if (!slider) return;

        // For future: implement carousel/slider functionality
        // Currently using CSS grid for display
    }

    // ==============================================
    // Form Validation (for future use)
    // ==============================================
    function initFormValidation() {
        const forms = document.querySelectorAll('form');

        forms.forEach(form => {
            form.addEventListener('submit', function(e) {
                // Add validation logic here
            });
        });
    }

    // ==============================================
    // Lazy Loading Images
    // ==============================================
    function initLazyLoading() {
        const lazyImages = document.querySelectorAll('img[data-src]');

        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.add('loaded');
                        imageObserver.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for older browsers
            lazyImages.forEach(img => {
                img.src = img.dataset.src;
            });
        }
    }

    // ==============================================
    // Counter Animation
    // ==============================================
    function animateCounter(element, target, duration = 2000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;

        const updateCounter = () => {
            current += increment;
            if (current < target) {
                element.textContent = Math.floor(current);
                requestAnimationFrame(updateCounter);
            } else {
                element.textContent = target;
            }
        };

        updateCounter();
    }

    // ==============================================
    // Scroll Progress Indicator
    // ==============================================
    function initScrollProgress() {
        const progressBar = document.createElement('div');
        progressBar.className = 'scroll-progress';
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, #6B3FA0, #C9A962);
            z-index: 9999;
            transition: width 0.1s ease;
        `;
        document.body.appendChild(progressBar);

        window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = (scrollTop / docHeight) * 100;
            progressBar.style.width = `${progress}%`;
        }, { passive: true });
    }

    // ==============================================
    // Current Year for Copyright
    // ==============================================
    function updateCopyright() {
        const copyrightYear = document.querySelector('.copyright');
        if (copyrightYear) {
            const year = new Date().getFullYear();
            copyrightYear.innerHTML = copyrightYear.innerHTML.replace(/\d{4}/, year);
        }
    }

    // ==============================================
    // Accessibility Improvements
    // ==============================================
    function initAccessibility() {
        // Skip to content link
        const skipLink = document.createElement('a');
        skipLink.href = '#concept';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'コンテンツにスキップ';
        skipLink.style.cssText = `
            position: absolute;
            top: -100%;
            left: 50%;
            transform: translateX(-50%);
            background: #6B3FA0;
            color: white;
            padding: 10px 20px;
            z-index: 10000;
            transition: top 0.3s;
            border-radius: 0 0 8px 8px;
        `;

        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '0';
        });

        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-100%';
        });

        document.body.insertBefore(skipLink, document.body.firstChild);

        // Focus visible styles
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-nav');
            }
        });

        document.addEventListener('mousedown', () => {
            document.body.classList.remove('keyboard-nav');
        });
    }

    // ==============================================
    // Performance: Debounce Function
    // ==============================================
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==============================================
    // Performance: Throttle Function
    // ==============================================
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ==============================================
    // Initialize All Functions
    // ==============================================
    function init() {
        // Add initial body class
        document.body.classList.add('no-scroll');

        // Initialize all modules
        initPreloader();
        initHeaderScroll();
        initMobileNav();
        initSmoothScroll();
        initVideoBackground();
        initParallax();
        initMenuEffects();
        initGallery();
        initButtonEffects();
        initTestimonialsSlider();
        initLazyLoading();
        initScrollProgress();
        updateCopyright();
        initAccessibility();

        // Log initialization
        console.log('KATE stage LASH website initialized');
    }

    // Run initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
