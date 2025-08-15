import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  margin?: number;
  elevation?: number;
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  padding,
  margin,
  elevation = 2,
}) => {
  const { colors, borderRadius } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: padding || 16,
    margin: margin || 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: elevation,
    },
    shadowOpacity: 0.1,
    shadowRadius: elevation * 2,
    elevation: elevation,
    ...style,
  };

  return <View style={cardStyle}>{children}</View>;
};

export default Card;