const mongoose = require('mongoose');

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const unsafePattern = /<[^>]*>|javascript:|data:|on\w+=/i;
const allowedPriorities = new Set(['low', 'medium', 'high']);

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function sanitizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return [...new Set(tags.map((tag) => normalizeText(tag).toLowerCase()).filter(Boolean))]
    .filter((tag) => tag.length <= 32 && !unsafePattern.test(tag))
    .slice(0, 12);
}

function validateAuthInput(email, password) {
  const errors = [];

  if (!emailPattern.test(email) || email.length > 120) {
    errors.push('A valid email is required');
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    errors.push('Password must contain between 8 and 72 characters');
  }

  return errors;
}

function validateObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function validateSafeText(label, value, options = {}) {
  const min = options.min || 0;
  const max = options.max || 120;

  if (typeof value !== 'string') {
    return `${label} must be a string`;
  }

  if (value.length < min) {
    return `${label} is required`;
  }

  if (value.length > max) {
    return `${label} must contain ${max} characters or less`;
  }

  if (unsafePattern.test(value)) {
    return `${label} contains unsafe content`;
  }

  return '';
}

function parseDateOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

function validatePriority(priority) {
  return allowedPriorities.has(priority);
}

module.exports = {
  allowedPriorities,
  normalizeEmail,
  normalizeText,
  parseDateOrNull,
  sanitizeTags,
  validateAuthInput,
  validateObjectId,
  validatePriority,
  validateSafeText
};
