// Global variables
let currentOrderId = null;
let paymentStatusInterval = null;

// DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize form validation
    initializeFormValidation();
    
    // Initialize modal
    initializeModal();
    
    // Initialize FAQ accordion
    initializeFAQ();
});

// Form validation and submission
function initializeFormValidation() {
    const form = document.getElementById('purchaseForm');
    if (!form) return;
    
    // Format phone input
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 11) {
            value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
        } else if (value.length >= 7) {
            value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
        } else if (value.length >= 3) {
            value = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
        } else if (value.length >= 1) {
            value = value.replace(/^(\d{0,2})/, '($1');
        }
        e.target.value = value;
    });
    
    // Format CPF input
    const cpfInput = document.getElementById('cpf');
    cpfInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length >= 11) {
            value = value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2}).*/, '$1.$2.$3-$4');
        } else if (value.length >= 9) {
            value = value.replace(/^(\d{3})(\d{3})(\d{0,3})(\d{0,2})/, '$1.$2.$3-$4');
        } else if (value.length >= 6) {
            value = value.replace(/^(\d{3})(\d{0,3})(\d{0,3})/, '$1.$2.$3');
        } else if (value.length >= 3) {
            value = value.replace(/^(\d{0,3})(\d{0,3})/, '$1.$2');
        }
        e.target.value = value;
    });
    
    // Form submission
    form.addEventListener('submit', handleFormSubmission);
}

async function handleFormSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name').trim(),
        phone: formData.get('phone').trim(),
        email: formData.get('email').trim(),
        cpf: formData.get('cpf').trim()
    };
    
    // Basic validation
    if (!validateFormData(data)) {
        return;
    }
    
    // Show loading step
    showStep('loadingStep');
    
    try {
        const response = await fetch('/api/create-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Store order ID for status checking
            currentOrderId = result.order_id;
            
            // Display QR code - prioritize brCodeBase64 for image, keep qr_code for PIX string
            const qrCodeImage = result.qr_code_base64;
            const pixCode = result.qr_code;
            if (qrCodeImage || pixCode) {
                displayQRCode(qrCodeImage, pixCode);
                showStep('qrStep');
            } else {
                showError('QR Code não foi gerado corretamente. Tente novamente.');
            }
            
            // Start checking payment status
            startPaymentStatusCheck();
        } else {
            // Show error
            showError(result.error || 'Erro ao processar pagamento. Tente novamente.');
        }
    } catch (error) {
        console.error('Payment error:', error);
        showError('Erro de conexão. Verifique sua internet e tente novamente.');
    }
}

function validateFormData(data) {
    const errors = [];
    
    if (!data.name || data.name.length < 2) {
        errors.push('Nome deve ter pelo menos 2 caracteres');
    }
    
    if (!data.phone || data.phone.replace(/\D/g, '').length < 10) {
        errors.push('Telefone deve ter pelo menos 10 dígitos');
    }
    
    if (!data.email || !isValidEmail(data.email)) {
        errors.push('E-mail inválido');
    }
    
    if (!data.cpf || !isValidCPF(data.cpf)) {
        errors.push('CPF inválido');
    }
    
    if (errors.length > 0) {
        showError(errors.join('\n'));
        return false;
    }
    
    return true;
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidCPF(cpf) {
    // Remove formatting
    cpf = cpf.replace(/\D/g, '');
    
    // Check length
    if (cpf.length !== 11) return false;
    
    // Check for known invalid patterns
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    // Validate CPF algorithm
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) return false;
    
    return true;
}

function displayQRCode(qrCodeImage, pixCode) {
    const container = document.getElementById('qrCodeContainer');
    if (!container) return;
    
    // Clear previous content
    container.innerHTML = '';
    
    // Create main container for both QR code and PIX code
    const qrWrapper = document.createElement('div');
    qrWrapper.style.display = 'flex';
    qrWrapper.style.flexDirection = 'column';
    qrWrapper.style.alignItems = 'center';
    qrWrapper.style.gap = '20px';
    
    // Create QR code image if available
    if (qrCodeImage) {
        const img = document.createElement('img');
        
        if (qrCodeImage.startsWith('data:image')) {
            img.src = qrCodeImage;
        } else {
            img.src = qrCodeImage.startsWith('data:') ? qrCodeImage : `data:image/png;base64,${qrCodeImage}`;
        }
        
        img.alt = 'QR Code para pagamento PIX';
        img.style.maxWidth = '200px';
        img.style.height = 'auto';
        img.style.border = '2px solid #f8f9fa';
        img.style.borderRadius = '8px';
        
        img.onerror = function() {
            container.innerHTML = '<p style="color: #dc3545;">Erro ao carregar QR Code. Tente novamente.</p>';
        };
        
        qrWrapper.appendChild(img);
    }
    
    // Create PIX copy section if code is available
    if (pixCode && !pixCode.startsWith('data:image')) {
        const pixSection = document.createElement('div');
        pixSection.style.width = '100%';
        pixSection.style.maxWidth = '300px';
        pixSection.style.marginTop = '15px';
        
        // PIX section title
        const pixTitle = document.createElement('p');
        pixTitle.textContent = 'Ou copie o código PIX:';
        pixTitle.style.fontSize = '14px';
        pixTitle.style.margin = '0 0 8px 0';
        pixTitle.style.color = '#666';
        pixTitle.style.textAlign = 'center';
        
        // PIX code input container
        const inputContainer = document.createElement('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.gap = '8px';
        inputContainer.style.alignItems = 'stretch';
        
        // PIX code input field
        const pixInput = document.createElement('input');
        pixInput.type = 'text';
        pixInput.value = pixCode;
        pixInput.readOnly = true;
        pixInput.id = 'pixCodeInput';
        pixInput.style.flex = '1';
        pixInput.style.padding = '10px';
        pixInput.style.border = '2px solid #27c84f';
        pixInput.style.borderRadius = '5px';
        pixInput.style.fontSize = '12px';
        pixInput.style.backgroundColor = '#f8f9fa';
        pixInput.style.color = '#333';
        pixInput.style.fontFamily = 'monospace';
        
        // Copy button
        const copyButton = document.createElement('button');
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.title = 'Copiar código PIX';
        copyButton.style.padding = '10px 15px';
        copyButton.style.border = 'none';
        copyButton.style.borderRadius = '5px';
        copyButton.style.backgroundColor = '#27c84f';
        copyButton.style.color = 'white';
        copyButton.style.cursor = 'pointer';
        copyButton.style.fontSize = '14px';
        copyButton.style.minWidth = '45px';
        copyButton.style.transition = 'background-color 0.2s';
        
        copyButton.addEventListener('click', function() {
            copyPixCode(pixCode, copyButton);
        });
        
        copyButton.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#22b944';
        });
        
        copyButton.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '#27c84f';
        });
        
        inputContainer.appendChild(pixInput);
        inputContainer.appendChild(copyButton);
        
        pixSection.appendChild(pixTitle);
        pixSection.appendChild(inputContainer);
        qrWrapper.appendChild(pixSection);
    }
    
    // If neither QR code image nor PIX code is available, show error
    if (!qrCodeImage && !pixCode) {
        container.innerHTML = '<p style="color: #dc3545;">Erro ao carregar dados do pagamento. Tente novamente.</p>';
        return;
    }
    
    container.appendChild(qrWrapper);
}

function copyPixCode(pixCode, button) {
    // Try using the modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(pixCode).then(function() {
            showCopySuccess(button);
        }).catch(function() {
            // Fallback to older method
            fallbackCopyToClipboard(pixCode, button);
        });
    } else {
        // Use fallback method for older browsers or non-secure contexts
        fallbackCopyToClipboard(pixCode, button);
    }
}

function fallbackCopyToClipboard(pixCode, button) {
    // Create a temporary textarea element
    const textArea = document.createElement('textarea');
    textArea.value = pixCode;
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopySuccess(button);
        } else {
            showCopyError(button);
        }
    } catch (err) {
        showCopyError(button);
    }
    
    document.body.removeChild(textArea);
}

function showCopySuccess(button) {
    const originalHtml = button.innerHTML;
    const originalTitle = button.title;
    
    button.innerHTML = '<i class="fas fa-check"></i>';
    button.title = 'Copiado!';
    button.style.backgroundColor = '#27c84f';
    button.style.color = 'white';
    
    setTimeout(function() {
        button.innerHTML = originalHtml;
        button.title = originalTitle;
        button.style.backgroundColor = '#27c84f';
        button.style.color = 'white';
    }, 2000);
}

function showCopyError(button) {
    const originalHtml = button.innerHTML;
    const originalTitle = button.title;
    
    button.innerHTML = '<i class="fas fa-times"></i>';
    button.title = 'Erro ao copiar';
    button.style.backgroundColor = '#dc3545';
    button.style.color = 'white';
    
    setTimeout(function() {
        button.innerHTML = originalHtml;
        button.title = originalTitle;
        button.style.backgroundColor = '#27c84f';
        button.style.color = 'white';
    }, 2000);
}

function startPaymentStatusCheck() {
    if (!currentOrderId) return;
    
    // Clear any existing interval
    if (paymentStatusInterval) {
        clearInterval(paymentStatusInterval);
    }
    
    // Check status every 3 seconds
    paymentStatusInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/payment-status/${currentOrderId}`);
            const result = await response.json();
            
            if (response.ok) {
                const status = result.status;
                updatePaymentStatus(status);
                
                if (status === 'approved' || status === 'paid') {
                    clearInterval(paymentStatusInterval);
                    showPaymentSuccess();
                } else if (status === 'cancelled' || status === 'failed' || status === 'expired') {
                    clearInterval(paymentStatusInterval);
                    updatePaymentStatus(status);
                }
            }
        } catch (error) {
            console.error('Status check error:', error);
        }
    }, 3000);
    
    // Stop checking after 10 minutes
    setTimeout(() => {
        if (paymentStatusInterval) {
            clearInterval(paymentStatusInterval);
        }
    }, 600000);
}

function updatePaymentStatus(status) {
    const statusElement = document.getElementById('statusText');
    const paymentStatus = document.querySelector('.payment-status');
    
    if (!statusElement || !paymentStatus) return;
    
    // Remove existing status classes
    paymentStatus.classList.remove('success', 'error');
    
    switch (status) {
        case 'pending':
        case 'waiting_payment':
            statusElement.innerHTML = '<i class="fas fa-clock"></i> Aguardando pagamento...';
            break;
        case 'approved':
        case 'paid':
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i> Pagamento aprovado!';
            paymentStatus.classList.add('success');
            break;
        case 'cancelled':
        case 'failed':
            statusElement.innerHTML = '<i class="fas fa-times-circle"></i> Pagamento não foi aprovado';
            paymentStatus.classList.add('error');
            break;
        case 'expired':
            statusElement.innerHTML = '<i class="fas fa-clock"></i> QR Code expirado';
            paymentStatus.classList.add('error');
            break;
        default:
            statusElement.innerHTML = '<i class="fas fa-clock"></i> Verificando status...';
    }
}

function showPaymentSuccess() {
    const statusText = document.getElementById('statusText');
    const qrContainer = document.querySelector('.qr-container');
    
    if (qrContainer) {
        qrContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <i class="fas fa-check-circle" style="font-size: 4rem; color: #27c84f; margin-bottom: 1rem;"></i>
                <h3 style="color: #27c84f; margin-bottom: 1rem; font-size: 1.5rem;">Parabéns pela sua compra!</h3>
                <p style="margin-bottom: 1.5rem;">Seu pagamento foi confirmado com sucesso!</p>
                <button class="cta-button primary" onclick="window.open('https://drive.google.com/drive/folders/1B2Hjl9ZXQGwTTT3BrdgtE1dLZuJGqmbz?usp=drive_link', '_blank')">
                    <i class="fas fa-external-link-alt"></i>
                    Acessar o BeautyStories
                </button>
            </div>
        `;
    }
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
    }
    showStep('errorStep');
}

function showStep(stepId) {
    // Hide all steps
    const steps = document.querySelectorAll('.step-content');
    steps.forEach(step => step.classList.remove('active'));
    
    // Show target step
    const targetStep = document.getElementById(stepId);
    if (targetStep) {
        targetStep.classList.add('active');
    }
}

// Modal functions
function initializeModal() {
    const modal = document.getElementById('purchaseModal');
    if (!modal) return;
    
    // Close modal when clicking outside
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closePurchasePopup();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            closePurchasePopup();
        }
    });
}

function openPurchasePopup() {
    const modal = document.getElementById('purchaseModal');
    if (modal) {
        // Reset to form step
        showStep('formStep');
        
        // Clear form
        const form = document.getElementById('purchaseForm');
        if (form) form.reset();
        
        // Clear any existing intervals
        if (paymentStatusInterval) {
            clearInterval(paymentStatusInterval);
            paymentStatusInterval = null;
        }
        
        // Show modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Focus first input
        setTimeout(() => {
            const firstInput = modal.querySelector('input[type="text"], input[type="email"]');
            if (firstInput) firstInput.focus();
        }, 300);
    }
}

function closePurchasePopup() {
    const modal = document.getElementById('purchaseModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
        
        // Clear payment status checking
        if (paymentStatusInterval) {
            clearInterval(paymentStatusInterval);
            paymentStatusInterval = null;
        }
        
        // Reset variables
        currentOrderId = null;
    }
}

// FAQ functionality
function initializeFAQ() {
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => toggleFaq(question));
    });
}

function toggleFaq(element) {
    const faqItem = element.closest('.faq-item');
    const answer = faqItem.querySelector('.faq-answer');
    const isActive = faqItem.classList.contains('active');
    
    // Close all FAQ items
    document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
        const ans = item.querySelector('.faq-answer');
        if (ans) ans.classList.remove('active');
    });
    
    // Open clicked item if it wasn't active
    if (!isActive) {
        faqItem.classList.add('active');
        if (answer) answer.classList.add('active');
    }
}

// Smooth scroll for internal links
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'A' && e.target.getAttribute('href').startsWith('#')) {
        e.preventDefault();
        const targetId = e.target.getAttribute('href').substring(1);
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }
});

// Performance optimization: Lazy loading for images
document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
});

// Error handling for global errors
window.addEventListener('error', function(e) {
    console.error('Global error:', e.error);
    // Log to console for debugging, could also send to analytics
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
    // Log to console for debugging
});
