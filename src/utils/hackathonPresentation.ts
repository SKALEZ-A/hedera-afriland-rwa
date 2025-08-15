import { logger } from './logger'
import DemoDataService from '../services/DemoDataService'
import ShowcaseScenarioService from '../services/ShowcaseScenarioService'

export interface PresentationSlide {
  id: string
  title: string
  content: string
  type: 'title' | 'content' | 'demo' | 'metrics' | 'conclusion'
  duration: number // seconds
  notes?: string
  visualElements?: string[]
}

export interface HackathonPresentation {
  title: string
  subtitle: string
  duration: number // total duration in minutes
  slides: PresentationSlide[]
  demoScenarios: string[] // scenario IDs to demonstrate
  keyMessages: string[]
}

class HackathonPresentationService {
  /**
   * Generate complete hackathon presentation
   */
  generatePresentation(): HackathonPresentation {
    const slides: PresentationSlide[] = [
      // Title Slide
      {
        id: 'title',
        title: 'GlobalLand: Tokenized Real Estate for Africa',
        content: `
# GlobalLand RWA Platform
## Democratizing Real Estate Investment Across Africa

**Built on Hedera Hashgraph**

*Enabling fractional property ownership through blockchain tokenization*

---

**Team:** GlobalLand Development Team
**Hackathon:** Hedera Hashgraph Hackathon 2024
**Date:** ${new Date().toLocaleDateString()}
        `,
        type: 'title',
        duration: 60,
        notes: 'Welcome and introduce the platform concept',
        visualElements: ['logo', 'africa-map', 'blockchain-visual']
      },

      // Problem Statement
      {
        id: 'problem',
        title: 'The Real Estate Investment Challenge in Africa',
        content: `
# The Problem We're Solving

## 🏠 High Investment Barriers
- Minimum investments of $50,000 - $500,000+
- Limited access to prime properties
- Complex legal processes

## 🌍 Cross-Border Investment Challenges
- Currency exchange complications
- Regulatory compliance across countries
- Lack of transparency in foreign markets

## 💰 Liquidity Issues
- Real estate traditionally illiquid
- Long holding periods required
- Difficulty in partial exits

## 📊 Limited Market Access
- Information asymmetry
- Lack of standardized investment platforms
- No fractional ownership options
        `,
        type: 'content',
        duration: 120,
        notes: 'Explain the current challenges in African real estate investment',
        visualElements: ['problem-infographic', 'market-statistics']
      },

      // Solution Overview
      {
        id: 'solution',
        title: 'Our Solution: Tokenized Real Estate Platform',
        content: `
# GlobalLand Solution

## 🔗 Blockchain-Powered Tokenization
- Properties divided into tradeable tokens
- Built on Hedera Hashgraph for speed and sustainability
- Smart contracts automate operations

## 💱 Fractional Investment
- Invest from as little as $10
- Diversify across multiple properties
- Accessible to retail investors

## 📱 Mobile-First Experience
- Native mobile apps for iOS and Android
- Mobile money integration (M-Pesa, MTN, Airtel)
- Real-time notifications and updates

## 🌐 Cross-Border Capabilities
- Multi-currency support
- Compliance with local regulations
- Diaspora investment opportunities
        `,
        type: 'content',
        duration: 150,
        notes: 'Present the core solution and value proposition',
        visualElements: ['solution-diagram', 'mobile-mockups', 'token-visualization']
      },

      // Technical Architecture
      {
        id: 'architecture',
        title: 'Technical Architecture & Hedera Integration',
        content: `
# Technical Architecture

## 🏗️ Core Components
- **Backend API:** Node.js/TypeScript with Express
- **Database:** PostgreSQL with Redis caching
- **Blockchain:** Hedera Hashgraph integration
- **Frontend:** React.js web application
- **Mobile:** React Native cross-platform app

## ⚡ Hedera Integration
- **HTS (Hedera Token Service):** Property tokenization
- **Smart Contracts:** Automated dividend distribution
- **Consensus Service:** Transaction logging
- **Mirror Nodes:** Real-time data synchronization

## 🔒 Security & Compliance
- KYC/AML verification workflows
- Multi-signature wallet support
- Audit trails and compliance reporting
- End-to-end encryption
        `,
        type: 'content',
        duration: 120,
        notes: 'Explain technical implementation and Hedera-specific features',
        visualElements: ['architecture-diagram', 'hedera-logo', 'security-icons']
      },

      // Demo Data Overview
      {
        id: 'demo-data',
        title: 'Demo Data & Market Scenarios',
        content: this.generateDemoDataSlide(),
        type: 'metrics',
        duration: 90,
        notes: 'Show the scale and diversity of demo data',
        visualElements: ['data-charts', 'property-map', 'user-demographics']
      },

      // Live Demo Introduction
      {
        id: 'demo-intro',
        title: 'Live Platform Demonstration',
        content: `
# Live Demo Overview

## 🎯 What We'll Demonstrate

### 1. Investor Journey (3 minutes)
- User registration and KYC
- Property browsing and analysis
- Investment execution with mobile payment

### 2. Property Tokenization (2 minutes)
- Property manager workflow
- Hedera token creation
- Smart contract deployment

### 3. Real-time Analytics (2 minutes)
- Business intelligence dashboard
- Performance monitoring
- User behavior analytics

### 4. Mobile Experience (2 minutes)
- Native mobile app features
- Mobile money integration
- Push notifications

**Total Demo Time: ~10 minutes**
        `,
        type: 'demo',
        duration: 60,
        notes: 'Set expectations for the live demonstration',
        visualElements: ['demo-timeline', 'feature-highlights']
      },

      // Business Impact
      {
        id: 'impact',
        title: 'Business Impact & Market Opportunity',
        content: `
# Business Impact

## 📈 Market Opportunity
- African real estate market: $3.2 trillion
- Growing middle class: 350 million people
- Diaspora remittances: $95 billion annually
- Digital payment adoption: 70%+ in key markets

## 🎯 Target Markets
- **Primary:** Kenya, Nigeria, Ghana, Rwanda, Uganda
- **Secondary:** South Africa, Tanzania, Senegal
- **Diaspora:** USA, UK, Canada, Europe

## 💡 Value Proposition
- **For Investors:** Lower barriers, higher liquidity, diversification
- **For Property Owners:** Access to capital, automated management
- **For Markets:** Increased transparency, foreign investment attraction

## 🚀 Growth Projections
- Year 1: $10M in tokenized assets
- Year 3: $100M across 5 countries
- Year 5: $1B+ pan-African platform
        `,
        type: 'content',
        duration: 120,
        notes: 'Highlight business potential and market opportunity',
        visualElements: ['market-charts', 'growth-projections', 'target-map']
      },

      // Technology Advantages
      {
        id: 'tech-advantages',
        title: 'Why Hedera Hashgraph?',
        content: `
# Why We Chose Hedera

## ⚡ Performance Benefits
- **Speed:** 10,000+ TPS vs 15 TPS (Ethereum)
- **Cost:** $0.0001 per transaction vs $20+ (Ethereum)
- **Finality:** 3-5 seconds vs 6+ minutes
- **Energy:** 0.00017 kWh per transaction (99.99% less than Bitcoin)

## 🌍 Perfect for Africa
- Low transaction costs enable micro-investments
- Fast finality supports mobile money integration
- Sustainable consensus aligns with ESG goals
- Enterprise-grade security for institutional adoption

## 🔧 Technical Features Used
- **HTS:** Native tokenization without smart contracts
- **Smart Contracts:** Automated dividend distribution
- **Consensus Service:** Immutable audit trails
- **Mirror Nodes:** Real-time data access

## 🏆 Competitive Advantages
- Lower operational costs = higher investor returns
- Faster transactions = better user experience
- Regulatory compliance = institutional adoption
- Carbon negative = ESG alignment
        `,
        type: 'content',
        duration: 120,
        notes: 'Justify technology choice and highlight Hedera benefits',
        visualElements: ['hedera-comparison', 'performance-metrics', 'sustainability-badge']
      },

      // Future Roadmap
      {
        id: 'roadmap',
        title: 'Roadmap & Future Development',
        content: `
# Development Roadmap

## 🎯 Phase 1: Foundation (Months 1-6)
- ✅ Core platform development
- ✅ Hedera integration
- ✅ Mobile applications
- ✅ Demo data and scenarios
- 🔄 Regulatory compliance framework
- 🔄 Pilot property partnerships

## 🚀 Phase 2: Launch (Months 7-12)
- 📋 Kenya market launch
- 📋 First property tokenizations
- 📋 Mobile money integration
- 📋 Investor onboarding
- 📋 Performance optimization

## 🌍 Phase 3: Expansion (Year 2)
- 📋 Nigeria and Ghana markets
- 📋 Secondary trading platform
- 📋 Institutional investor features
- 📋 Advanced analytics and AI
- 📋 DeFi integrations

## 🏆 Phase 4: Scale (Year 3+)
- 📋 Pan-African presence
- 📋 Property development financing
- 📋 Insurance and risk products
- 📋 Cross-chain interoperability
- 📋 Global expansion
        `,
        type: 'content',
        duration: 90,
        notes: 'Show development timeline and growth strategy',
        visualElements: ['roadmap-timeline', 'expansion-map', 'feature-evolution']
      },

      // Conclusion
      {
        id: 'conclusion',
        title: 'Transforming African Real Estate Investment',
        content: `
# GlobalLand: The Future of Real Estate Investment

## 🎯 Key Achievements
- ✅ Full-stack tokenization platform
- ✅ Hedera blockchain integration
- ✅ Mobile-first user experience
- ✅ Comprehensive demo scenarios
- ✅ Scalable architecture

## 🌟 Unique Value Proposition
- **Accessibility:** $10 minimum investment vs $50,000+
- **Liquidity:** Trade tokens vs 5-10 year holds
- **Transparency:** Real-time data vs opaque markets
- **Efficiency:** Automated processes vs manual operations
- **Sustainability:** Carbon-negative blockchain

## 🚀 Ready for Market
- Production-ready codebase
- Comprehensive testing suite
- Security and compliance framework
- Scalable infrastructure
- Go-to-market strategy

## 💡 The Vision
**Democratizing real estate investment across Africa, one token at a time.**

---

### Thank you for your attention!
**Questions & Discussion**
        `,
        type: 'conclusion',
        duration: 120,
        notes: 'Wrap up with key achievements and call to action',
        visualElements: ['success-metrics', 'vision-statement', 'contact-info']
      }
    ]

    return {
      title: 'GlobalLand: Tokenized Real Estate for Africa',
      subtitle: 'Built on Hedera Hashgraph',
      duration: Math.ceil(slides.reduce((total, slide) => total + slide.duration, 0) / 60), // Convert to minutes
      slides,
      demoScenarios: [
        'investor-onboarding',
        'property-tokenization',
        'analytics-dashboard',
        'mobile-investment'
      ],
      keyMessages: [
        'Democratizing real estate investment across Africa',
        'Leveraging Hedera Hashgraph for speed, cost, and sustainability',
        'Mobile-first approach with local payment integration',
        'Comprehensive platform ready for market deployment',
        'Significant business opportunity in underserved markets'
      ]
    }
  }

  /**
   * Generate demo data slide content
   */
  private generateDemoDataSlide(): string {
    const summary = DemoDataService.getDemoDataSummary()
    const scenarioStats = ShowcaseScenarioService.getScenarioStatistics()

    return `
# Demo Data & Scenarios

## 📊 Comprehensive Demo Dataset

### 👥 Users (${summary.users.total} total)
- **Investors:** ${summary.users.byRole.investor || 0} across ${Object.keys(summary.users.byCountry).length} countries
- **Property Managers:** ${summary.users.byRole.property_manager || 0} managing premium properties
- **Administrators:** ${summary.users.byRole.admin || 0} overseeing platform operations

### 🏠 Properties (${summary.properties.total} total)
- **Total Value:** $${(summary.properties.totalValue / 1000000).toFixed(1)}M across Africa
- **Property Types:** ${Object.keys(summary.properties.byType).join(', ')}
- **Countries:** ${Object.keys(summary.properties.byCountry).join(', ')}

### 💰 Investments (${summary.investments.total} total)
- **Total Investment Value:** $${(summary.investments.totalValue / 1000000).toFixed(1)}M
- **Average Investment:** $${Math.round(summary.investments.averageInvestment).toLocaleString()}
- **Active Portfolios:** Diversified across multiple properties

### 🎬 Interactive Scenarios (${scenarioStats.totalScenarios} total)
- **User Journeys:** Complete investor and manager workflows
- **Technical Demos:** Blockchain and smart contract operations
- **Analytics:** Real-time monitoring and business intelligence
- **Mobile Experience:** Native app features and mobile payments

## 🎯 Ready for Live Demonstration
All scenarios are executable with realistic data and user interactions.
    `
  }

  /**
   * Generate presentation script
   */
  generatePresentationScript(): string {
    const presentation = this.generatePresentation()
    
    let script = `# ${presentation.title}\n`
    script += `## ${presentation.subtitle}\n\n`
    script += `**Total Duration:** ${presentation.duration} minutes\n\n`
    script += `**Key Messages:**\n`
    presentation.keyMessages.forEach(message => {
      script += `- ${message}\n`
    })
    script += `\n---\n\n`

    presentation.slides.forEach((slide, index) => {
      script += `## Slide ${index + 1}: ${slide.title}\n`
      script += `**Duration:** ${slide.duration} seconds\n`
      script += `**Type:** ${slide.type}\n\n`
      
      if (slide.notes) {
        script += `**Presenter Notes:** ${slide.notes}\n\n`
      }
      
      if (slide.visualElements && slide.visualElements.length > 0) {
        script += `**Visual Elements:** ${slide.visualElements.join(', ')}\n\n`
      }
      
      script += `**Content:**\n${slide.content}\n\n`
      script += `---\n\n`
    })

    script += `## Demo Scenarios to Execute\n\n`
    presentation.demoScenarios.forEach(scenarioId => {
      const scenario = ShowcaseScenarioService.getScenario(scenarioId)
      if (scenario) {
        script += `### ${scenario.title}\n`
        script += `- **Duration:** ${Math.floor(scenario.duration / 60)} minutes\n`
        script += `- **Category:** ${scenario.category}\n`
        script += `- **Description:** ${scenario.description}\n\n`
      }
    })

    return script
  }

  /**
   * Get presentation timing breakdown
   */
  getPresentationTiming(): {
    totalDuration: number
    slideBreakdown: Array<{ title: string; duration: number; cumulativeTime: number }>
    demoTime: number
    presentationTime: number
  } {
    const presentation = this.generatePresentation()
    let cumulativeTime = 0
    
    const slideBreakdown = presentation.slides.map(slide => {
      cumulativeTime += slide.duration
      return {
        title: slide.title,
        duration: slide.duration,
        cumulativeTime
      }
    })

    const demoTime = presentation.demoScenarios.reduce((total, scenarioId) => {
      const scenario = ShowcaseScenarioService.getScenario(scenarioId)
      return total + (scenario ? scenario.duration : 0)
    }, 0)

    return {
      totalDuration: presentation.duration * 60, // Convert to seconds
      slideBreakdown,
      demoTime,
      presentationTime: cumulativeTime
    }
  }

  /**
   * Generate hackathon submission summary
   */
  generateSubmissionSummary(): {
    project: any
    technical: any
    business: any
    demo: any
  } {
    const demoSummary = DemoDataService.getDemoDataSummary()
    const scenarioStats = ShowcaseScenarioService.getScenarioStatistics()

    return {
      project: {
        name: 'GlobalLand RWA Platform',
        tagline: 'Tokenized Real Estate Investment for Africa',
        description: 'A comprehensive blockchain-based platform that democratizes real estate investment across Africa through property tokenization, fractional ownership, and mobile-first user experience.',
        category: 'DeFi/RWA (Real World Assets)',
        blockchain: 'Hedera Hashgraph',
        targetMarket: 'African real estate investment market'
      },
      technical: {
        architecture: 'Full-stack web and mobile application',
        backend: 'Node.js/TypeScript with Express framework',
        frontend: 'React.js web application',
        mobile: 'React Native cross-platform app',
        database: 'PostgreSQL with Redis caching',
        blockchain: 'Hedera Hashgraph with HTS and Smart Contracts',
        features: [
          'Property tokenization using HTS',
          'Automated dividend distribution via smart contracts',
          'Mobile money payment integration',
          'KYC/AML compliance workflows',
          'Real-time analytics and monitoring',
          'Secondary market trading',
          'Multi-currency support',
          'Cross-border investment capabilities'
        ],
        codeQuality: {
          testCoverage: '85%+',
          documentation: 'Comprehensive API and user documentation',
          security: 'Security auditing and compliance framework',
          scalability: 'Microservices architecture with horizontal scaling'
        }
      },
      business: {
        marketOpportunity: '$3.2 trillion African real estate market',
        targetUsers: [
          'Retail investors seeking real estate exposure',
          'African diaspora wanting homeland investments',
          'Property developers needing capital access',
          'Institutional investors seeking African exposure'
        ],
        revenueModel: [
          'Platform transaction fees (2.5%)',
          'Property management fees (1-2% annually)',
          'Secondary market trading fees (0.5%)',
          'Premium analytics and tools subscriptions'
        ],
        competitiveAdvantage: [
          'First mover in African tokenized real estate',
          'Mobile-first approach with local payment integration',
          'Hedera blockchain for low costs and high performance',
          'Comprehensive regulatory compliance framework'
        ]
      },
      demo: {
        demoData: demoSummary,
        scenarios: scenarioStats,
        liveDemo: 'Fully functional platform with realistic data',
        userAccounts: 'Pre-configured demo accounts for all user types',
        mobileApp: 'Native mobile applications with full feature set',
        blockchain: 'Live Hedera testnet integration with real transactions'
      }
    }
  }
}

export default new HackathonPresentationService()