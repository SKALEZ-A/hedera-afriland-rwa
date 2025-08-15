# GlobalLand Mobile App

React Native mobile application for the GlobalLand real estate tokenization platform.

## Features

- **Cross-Platform**: Built with React Native for iOS and Android
- **Modern Architecture**: TypeScript, React Navigation v6, React Query
- **Biometric Authentication**: Face ID, Touch ID, and fingerprint support
- **Real-time Updates**: WebSocket integration for live notifications
- **Push Notifications**: Firebase Cloud Messaging integration
- **Offline Support**: Data caching and offline functionality
- **Mobile Payments**: Integration with mobile money services
- **Charts & Analytics**: Portfolio performance visualization
- **Camera Integration**: Document scanning and KYC verification
- **Secure Storage**: Keychain/Keystore for sensitive data
- **Dark Mode**: System-based theme switching

## Tech Stack

- **React Native 0.72** - Mobile framework
- **TypeScript** - Type safety
- **React Navigation v6** - Navigation
- **React Query** - Server state management
- **React Hook Form** - Form handling
- **Axios** - HTTP client
- **Socket.io Client** - Real-time communication
- **AsyncStorage** - Local storage
- **Keychain** - Secure credential storage
- **React Native Biometrics** - Biometric authentication
- **React Native Push Notification** - Push notifications
- **React Native Vector Icons** - Icons
- **React Native Chart Kit** - Data visualization
- **React Native Camera** - Camera functionality
- **React Native Permissions** - Permission handling

## Getting Started

### Prerequisites

- Node.js 16+
- React Native CLI
- Xcode (for iOS development)
- Android Studio (for Android development)
- CocoaPods (for iOS dependencies)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Install iOS dependencies:
```bash
cd ios && pod install && cd ..
```

3. Configure environment:
```bash
cp .env.example .env
```

4. Update environment variables:
```env
API_URL=http://localhost:3001/api
WS_URL=ws://localhost:3001
```

### Running the App

#### iOS
```bash
npm run ios
```

#### Android
```bash
npm run android
```

#### Start Metro bundler
```bash
npm start
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── ui/             # Basic UI components
├── contexts/           # React contexts
├── navigation/         # Navigation configuration
├── screens/            # Screen components
│   ├── auth/          # Authentication screens
│   ├── home/          # Home screen
│   ├── properties/    # Property screens
│   ├── portfolio/     # Portfolio screens
│   ├── trading/       # Trading screens
│   └── more/          # Additional screens
├── services/          # API services
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── config/            # Configuration files
```

## Key Features Implementation

### Authentication
- JWT token-based authentication
- Biometric authentication (Face ID, Touch ID, Fingerprint)
- Secure credential storage in Keychain/Keystore
- Automatic token refresh
- Social login integration (planned)

### Real-time Updates
- WebSocket connection management
- Real-time portfolio updates
- Push notifications for important events
- Background app state handling
- Automatic reconnection

### Mobile-Optimized UI
- Native navigation patterns
- Touch-friendly interfaces
- Responsive design for all screen sizes
- Platform-specific UI adaptations
- Accessibility support

### Offline Support
- Data caching with React Query
- Offline transaction queuing
- Network status monitoring
- Sync when connection restored

### Security
- Biometric authentication
- Secure storage for sensitive data
- Certificate pinning (planned)
- App integrity checks
- Jailbreak/root detection (planned)

## API Integration

The mobile app integrates with the GlobalLand API:

- **Authentication**: Login, register, biometric auth
- **Properties**: Browse, search, view details
- **Investments**: Purchase, portfolio management
- **Trading**: Order management, market data
- **Payments**: Mobile money, card payments
- **Notifications**: Real-time updates

## State Management

- **Server State**: React Query for API data caching
- **Client State**: React Context for authentication, theme
- **Local Storage**: AsyncStorage for preferences
- **Secure Storage**: Keychain for credentials
- **WebSocket State**: Custom context for real-time data

## Push Notifications

### Setup
1. Configure Firebase project
2. Add google-services.json (Android) and GoogleService-Info.plist (iOS)
3. Configure notification channels and categories

### Features
- Investment confirmations
- Dividend payments
- Trading updates
- Property updates
- Custom notification categories

## Mobile Payments

### Supported Methods
- Mobile Money (M-Pesa, MTN Mobile Money, Airtel Money)
- Credit/Debit Cards (Stripe)
- Bank transfers
- Cryptocurrency (planned)

### Integration
- Native mobile money SDKs
- Secure payment processing
- Transaction status tracking
- Receipt generation

## Testing

### Unit Tests
```bash
npm test
```

### E2E Tests (Detox)
```bash
# iOS
npm run e2e:ios

# Android
npm run e2e:android
```

### Manual Testing
- Device testing on multiple screen sizes
- Biometric authentication testing
- Network connectivity testing
- Background/foreground state testing

## Build & Deployment

### Development Build
```bash
# iOS
npm run build:ios

# Android
npm run build:android
```

### Production Build
```bash
# iOS
cd ios && xcodebuild -workspace GlobalLand.xcworkspace -scheme GlobalLand -configuration Release -destination generic/platform=iOS -archivePath GlobalLand.xcarchive archive

# Android
cd android && ./gradlew assembleRelease
```

### App Store Deployment
1. Configure app signing
2. Update version numbers
3. Generate release builds
4. Upload to App Store Connect / Google Play Console
5. Submit for review

## Configuration

### Environment Variables
- `API_URL` - Backend API URL
- `WS_URL` - WebSocket server URL
- `FIREBASE_CONFIG` - Firebase configuration

### App Configuration
- Bundle identifiers
- App icons and splash screens
- Permissions and capabilities
- Deep linking schemes

## Performance Optimization

- Image optimization and caching
- Bundle size optimization
- Memory leak prevention
- Battery usage optimization
- Network request optimization

## Security Considerations

- API key protection
- Certificate pinning
- Biometric data protection
- Secure storage implementation
- Code obfuscation (production)

## Troubleshooting

### Common Issues
1. **Metro bundler issues**: Clear cache with `npm start --reset-cache`
2. **iOS build issues**: Clean build folder and reinstall pods
3. **Android build issues**: Clean gradle cache
4. **Permission issues**: Check platform-specific permission setup

### Debug Tools
- React Native Debugger
- Flipper integration
- Xcode/Android Studio debuggers
- Network inspection tools

## Contributing

1. Follow React Native best practices
2. Use TypeScript for type safety
3. Write tests for new features
4. Follow the existing code style
5. Update documentation

## License

MIT License - see LICENSE file for details.