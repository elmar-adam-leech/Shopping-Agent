(function() {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var storeDomain = script.getAttribute('data-store-domain') || '';
  var mode = script.getAttribute('data-mode') || 'chat';
  var position = script.getAttribute('data-position') || 'bottom-right';
  var productHandle = script.getAttribute('data-product-handle') || '';
  var collectionHandle = script.getAttribute('data-collection-handle') || '';
  var cartToken = script.getAttribute('data-cart-token') || '';
  var width = script.getAttribute('data-width') || '400px';
  var height = script.getAttribute('data-height') || '600px';
  var containerId = script.getAttribute('data-container') || '';

  if (!storeDomain) {
    console.error('[ShopMCP] data-store-domain attribute is required');
    return;
  }

  var baseUrl = script.src.replace(/\/embed\.js(\?.*)?$/, '');

  var routeMap = {
    chat: '/embed/' + storeDomain + '/chat',
    search: '/embed/' + storeDomain + '/search',
    assistant: '/embed/' + storeDomain + '/assistant',
    product: '/embed/' + storeDomain + '/product/' + productHandle
  };

  var route = routeMap[mode] || routeMap.chat;

  var params = ['mode=embed'];
  if (productHandle) params.push('productHandle=' + encodeURIComponent(productHandle));
  if (collectionHandle) params.push('collectionHandle=' + encodeURIComponent(collectionHandle));
  if (cartToken) params.push('cartToken=' + encodeURIComponent(cartToken));

  var iframeSrc = baseUrl + route + '?' + params.join('&');

  var iframe = document.createElement('iframe');
  iframe.src = iframeSrc;
  iframe.style.border = 'none';
  iframe.style.width = width;
  iframe.style.height = height;
  iframe.style.borderRadius = '12px';
  iframe.style.overflow = 'hidden';
  iframe.allow = 'clipboard-write';
  iframe.title = 'ShopMCP AI Assistant';

  if (containerId) {
    var container = document.getElementById(containerId);
    if (container) {
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      container.appendChild(iframe);
      return;
    }
  }

  var wrapper = document.createElement('div');
  wrapper.id = 'shopmcp-embed';
  wrapper.style.position = 'fixed';
  wrapper.style.zIndex = '9999';
  wrapper.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
  wrapper.style.borderRadius = '12px';
  wrapper.style.overflow = 'hidden';

  if (position === 'bottom-left') {
    wrapper.style.bottom = '20px';
    wrapper.style.left = '20px';
  } else if (position === 'top-right') {
    wrapper.style.top = '20px';
    wrapper.style.right = '20px';
  } else if (position === 'top-left') {
    wrapper.style.top = '20px';
    wrapper.style.left = '20px';
  } else {
    wrapper.style.bottom = '20px';
    wrapper.style.right = '20px';
  }

  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);
})();
