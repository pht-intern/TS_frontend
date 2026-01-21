const purgecss = require('@fullhuman/postcss-purgecss');
const cssnano = require('cssnano');

module.exports = {
  plugins: [
    purgecss({
      content: [
        './**/*.html',
        './js/**/*.js'
      ],
      safelist: [
        // Keep dynamic classes
        /^dashboard-/,
        /^contact-inquiry-/,
        /^status-/,
        /^modal-/,
        /^loading-/,
        /^error-/,
        /^success-/,
        /^authenticated/,
        // Keep Font Awesome classes
        /^fa-/,
        /^fas/,
        /^far/,
        /^fab/,
        // Keep Quill editor classes
        /^ql-/,
        // Keep Chart.js classes
        /^chart-/,
        // Keep dynamically generated classes
        /data-stat-/,
        /data-step-/,
        // Keep animation classes
        /^animate-/,
        /^fade-/,
        /^slide-/,
        // Keep utility classes that might be added dynamically
        /^active$/,
        /^hidden$/,
        /^show$/,
        /^visible$/,
        /^invisible$/,
        // Keep responsive classes
        /^sm:/,
        /^md:/,
        /^lg:/,
        /^xl:/,
        // Keep state classes
        /^is-/,
        /^has-/,
        // Keep vendor prefixes
        /^-webkit-/,
        /^-moz-/,
        /^-ms-/,
        /^-o-/
      ],
      defaultExtractor: content => {
        // Extract classes, IDs, and attributes
        const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
        const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
        return broadMatches.concat(innerMatches);
      }
    }),
    cssnano({
      preset: ['default', {
        discardComments: {
          removeAll: true
        },
        normalizeWhitespace: true,
        minifyFontValues: true,
        minifySelectors: true
      }]
    })
  ]
};
