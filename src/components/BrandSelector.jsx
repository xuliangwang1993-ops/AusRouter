import { useApp } from '../contexts/AppContext.jsx';
import { config } from '../config/providers.js';
import './BrandSelector.css';

export const BrandSelector = () => {
  const { switchBrand } = useApp();

  const brands = [
    { id: 'chatgpt', name: 'ChatGPT', icon: '💬' },
    { id: 'claude', name: 'Claude', icon: '🤖' },
    { id: 'copilot', name: 'Copilot', icon: '✨' },
    { id: 'gemini', name: 'Gemini', icon: '💎' },
    { id: 'grok', name: 'Grok', icon: '🚀' },
    { id: 'placeholder', name: 'More', icon: '➕' }
  ];

  const handleBrandClick = (brandId) => {
    const brand = config.brands[brandId];
    if (brand && !brand.comingSoon) {
      switchBrand(brandId);
    }
  };

  return (
    <div className="brand-selector">
      <div className="brand-grid">
        {brands.map(brand => {
          const brandConfig = config.brands[brand.id];
          const isComingSoon = brandConfig?.comingSoon;
          
          return (
            <button
              key={brand.id}
              className={`brand-card ${isComingSoon ? 'coming-soon' : ''}`}
              onClick={() => handleBrandClick(brand.id)}
              disabled={isComingSoon}
            >
              <div className="brand-icon">{brand.icon}</div>
              <div className="brand-name">{brand.name}</div>
              {isComingSoon && <div className="brand-badge">Soon</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
