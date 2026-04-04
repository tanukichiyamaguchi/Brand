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
        const scrollThreshold = 100;
        let ticking = false;

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const currentScroll = window.pageYOffset;
                    if (currentScroll > scrollThreshold) {
                        header.classList.add('scrolled');
                    } else {
                        header.classList.remove('scrolled');
                    }
                    ticking = false;
                });
                ticking = true;
            }
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
    // FAQ Accordion
    // ==============================================
    function initFAQ() {
        const faqItems = document.querySelectorAll('.faq-item');

        faqItems.forEach(item => {
            const question = item.querySelector('.faq-question');
            if (!question) return;

            question.addEventListener('click', () => {
                const isActive = item.classList.contains('active');

                // Close all other items
                faqItems.forEach(other => {
                    other.classList.remove('active');
                    const btn = other.querySelector('.faq-question');
                    if (btn) btn.setAttribute('aria-expanded', 'false');
                });

                // Toggle current item
                if (!isActive) {
                    item.classList.add('active');
                    question.setAttribute('aria-expanded', 'true');
                }
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
    // Scroll Progress Indicator (GPU optimized)
    // ==============================================
    function initScrollProgress() {
        const progressBar = document.createElement('div');
        progressBar.className = 'scroll-progress';
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, #6B3FA0, #C9A962);
            z-index: 9999;
            transform-origin: left;
            transform: scaleX(0);
            will-change: transform;
            pointer-events: none;
        `;
        document.body.appendChild(progressBar);

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrollTop = window.pageYOffset;
                    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                    const progress = docHeight > 0 ? scrollTop / docHeight : 0;
                    progressBar.style.transform = `scaleX(${progress})`;
                    ticking = false;
                });
                ticking = true;
            }
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
        skipLink.href = '#introduction';
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
        initFAQ();
        initLazyLoading();
        initScrollProgress();
        updateCopyright();
        initAccessibility();
    }

    // Run initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
