'use strict';

const form = document.querySelector('#contactForm');
const statusBox = document.querySelector('#formStatus');
const messageInput = document.querySelector('#message');
const messageCounter = document.querySelector('#messageCounter');
const submitButton = form.querySelector('button[type="submit"]');

const fields = {
  name: document.querySelector('#name'),
  email: document.querySelector('#email'),
  phone: document.querySelector('#phone'),
  subject: document.querySelector('#subject'),
  message: messageInput,
  consent: document.querySelector('#consent'),
  website: document.querySelector('#website')
};

const errors = {
  name: document.querySelector('#nameError'),
  email: document.querySelector('#emailError'),
  phone: document.querySelector('#phoneError'),
  subject: document.querySelector('#subjectError'),
  message: document.querySelector('#messageError'),
  consent: document.querySelector('#consentError')
};

const allowedSubjects = new Set(['devis', 'support', 'partenariat', 'autre']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phonePattern = /^[+()0-9 .-]{8,20}$/;
const unsafePattern = /<[^>]*>|javascript:|data:|on\w+=/i;

function normalizeText(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function hasUnsafeContent(value) {
  return unsafePattern.test(value);
}

function setFieldError(field, errorElement, message) {
  field.setAttribute('aria-invalid', message ? 'true' : 'false');
  errorElement.textContent = message;
}

function setStatus(message, type) {
  statusBox.textContent = message;
  statusBox.className = `form-status ${type || ''}`.trim();
}

function validateName() {
  const value = normalizeText(fields.name.value);

  if (!value) {
    return 'Le nom est obligatoire.';
  }

  if (value.length < 2 || value.length > 80) {
    return 'Le nom doit contenir entre 2 et 80 caracteres.';
  }

  if (hasUnsafeContent(value)) {
    return 'Le nom contient un contenu non autorise.';
  }

  if (!/^[\p{L}\p{M}' -]+$/u.test(value)) {
    return 'Le nom ne doit contenir que des lettres, espaces, apostrophes ou tirets.';
  }

  fields.name.value = value;
  return '';
}

function validateEmail() {
  const value = fields.email.value.trim().toLowerCase();

  if (!value) {
    return "L'adresse email est obligatoire.";
  }

  if (value.length > 120 || !emailPattern.test(value)) {
    return "L'adresse email n'est pas valide.";
  }

  if (hasUnsafeContent(value)) {
    return "L'adresse email contient un contenu non autorise.";
  }

  fields.email.value = value;
  return '';
}

function validatePhone() {
  const value = normalizeText(fields.phone.value);

  if (!value) {
    return '';
  }

  if (!phonePattern.test(value)) {
    return 'Le telephone doit contenir 8 a 20 caracteres valides.';
  }

  fields.phone.value = value;
  return '';
}

function validateSubject() {
  if (!allowedSubjects.has(fields.subject.value)) {
    return 'Choisissez un sujet.';
  }

  return '';
}

function validateMessage() {
  const value = fields.message.value.trim();

  if (!value) {
    return 'Le message est obligatoire.';
  }

  if (value.length < 20 || value.length > 800) {
    return 'Le message doit contenir entre 20 et 800 caracteres.';
  }

  if (hasUnsafeContent(value)) {
    return 'Le message contient du code ou des balises non autorises.';
  }

  fields.message.value = value;
  return '';
}

function validateConsent() {
  if (!fields.consent.checked) {
    return 'Vous devez accepter d\'etre recontacte.';
  }

  return '';
}

function validateHoneypot() {
  return fields.website.value.trim() === '';
}

function validateForm() {
  const validation = {
    name: validateName(),
    email: validateEmail(),
    phone: validatePhone(),
    subject: validateSubject(),
    message: validateMessage(),
    consent: validateConsent()
  };

  Object.entries(validation).forEach(([key, message]) => {
    setFieldError(fields[key], errors[key], message);
  });

  return Object.values(validation).every((message) => message === '');
}

function updateCounter() {
  messageCounter.textContent = `${fields.message.value.length}/800`;
}

function isRateLimited() {
  const lastSubmission = Number(sessionStorage.getItem('lastContactSubmission') || 0);
  return Date.now() - lastSubmission < 10000;
}

function rememberSubmission() {
  sessionStorage.setItem('lastContactSubmission', String(Date.now()));
}

Object.entries(fields).forEach(([key, field]) => {
  if (key === 'website') {
    return;
  }

  const eventName = field.type === 'checkbox' || field.tagName === 'SELECT' ? 'change' : 'input';

  field.addEventListener(eventName, () => {
    if (key === 'message') {
      updateCounter();
    }

    if (errors[key]) {
      setFieldError(field, errors[key], '');
    }

    setStatus('', '');
  });
});

form.addEventListener('reset', () => {
  window.setTimeout(() => {
    Object.entries(errors).forEach(([key, errorElement]) => {
      setFieldError(fields[key], errorElement, '');
    });

    updateCounter();
    setStatus('', '');
    submitButton.disabled = false;
  }, 0);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!validateHoneypot()) {
    setStatus('Soumission refusee.', 'error-status');
    return;
  }

  if (isRateLimited()) {
    setStatus('Merci de patienter quelques secondes avant un nouvel envoi.', 'error-status');
    return;
  }

  if (!validateForm()) {
    setStatus('Corrigez les champs signales avant de continuer.', 'error-status');
    const firstInvalid = form.querySelector('[aria-invalid="true"]');

    if (firstInvalid) {
      firstInvalid.focus();
    }

    return;
  }

  submitButton.disabled = true;
  rememberSubmission();

  const safeName = normalizeText(fields.name.value);
  setStatus(`Merci ${safeName}. Votre demande est validee cote navigateur.`, 'success');
});

updateCounter();
