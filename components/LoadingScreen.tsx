import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../theme';

export const LoadingScreen: React.FC = () => {
	return (
		<View style={styles.container}>
			{/* Logo */}
			<View style={styles.logoContainer}>
				<Image
					source={require('../assets/login-title-icon.png')}
					style={styles.logo}
					contentFit="contain"
					transition={1000}
				/>
			</View>

			{/* Spinner */}
			<ActivityIndicator
				size="large"
				color={theme.colors.primary}
				style={styles.spinner}
			/>

			{/* Loading Text */}
			<Text style={styles.text}>拜托再等等就好...</Text>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#fff',
	},
	logoContainer: {
		marginBottom: 24,
	},
	logo: {
		width: 280, // Slightly smaller
		height: 240,
		marginBottom: 40,
		borderRadius: 12,
	},
	spinner: {
		marginBottom: 16,
	},
	text: {
		fontSize: 16,
		color: theme.colors.text.secondary,
		marginTop: 12,
	},
});
