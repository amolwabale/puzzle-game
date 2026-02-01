import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as React from 'react';
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Button,
  Text,
  Surface,
  TextInput,
  HelperText,
  useTheme,
} from 'react-native-paper';
import { AuthStackParamList } from '../../navigation/StackParam';
import { RegisterUser } from '../../service/IdentityService';
import { RegisterPayload } from '../../model/Register';

export default function RegisterScreen() {
  const theme = useTheme();
  const navigation =
    useNavigation<
      NativeStackNavigationProp<AuthStackParamList, 'AuthScreen'>
    >();
  const handleBack = () => {
    navigation.navigate('AuthScreen');
  };

  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [mobile, setMobile] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = 'First name is required';
    if (!lastName.trim()) newErrors.lastName = 'Last name is required';

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email';
    }

    if (!mobile.trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^[0-9]{10}$/.test(mobile)) {
      newErrors.mobile = 'Mobile number must be 10 digits';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Minimum 6 characters required';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      await RegisterUser({
        firstName,
        lastName,
        email,
        password,
        mobile,
        address,
      });

      Alert.alert(
        'Registration Successful',
        'Your account has been created successfully. Please login.',
        [{ text: 'OK', onPress: handleBack }],
      );
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        // Note: using BOTH KeyboardAvoidingView + automaticallyAdjustKeyboardInsets can feel jumpy on long forms.
        // We rely on KeyboardAvoidingView + natural scrolling for smoother behavior.
        automaticallyAdjustKeyboardInsets={false}
        contentInsetAdjustmentBehavior={
          Platform.OS === 'ios' ? 'automatic' : undefined
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
        showsVerticalScrollIndicator={false}
      >
        <Surface style={styles.card} elevation={4}>
          <Text
            variant="headlineMedium"
            style={[styles.title, { color: theme.colors.primary }]}
          >
            Create Account
          </Text>

          {/* First Name */}
          <TextInput
            label="First Name *"
            mode="outlined"
            value={firstName}
            onChangeText={text => {
              setFirstName(text);
              setErrors({ ...errors, firstName: '' });
            }}
            error={!!errors.firstName}
            style={styles.input}
          />
          <HelperText type="error" visible={!!errors.firstName}>
            {errors.firstName}
          </HelperText>

          {/* Last Name */}
          <TextInput
            label="Last Name *"
            mode="outlined"
            value={lastName}
            onChangeText={text => {
              setLastName(text);
              setErrors({ ...errors, lastName: '' });
            }}
            error={!!errors.lastName}
            style={styles.input}
          />
          <HelperText type="error" visible={!!errors.lastName}>
            {errors.lastName}
          </HelperText>

          {/* Email */}
          <TextInput
            label="Email *"
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={text => {
              setEmail(text);
              setErrors({ ...errors, email: '' });
            }}
            error={!!errors.email}
            style={styles.input}
          />
          <HelperText type="error" visible={!!errors.email}>
            {errors.email}
          </HelperText>

          {/* Mobile */}
          <TextInput
            label="Mobile Number *"
            mode="outlined"
            keyboardType="phone-pad"
            maxLength={10}
            value={mobile}
            onChangeText={text => {
              setMobile(text);
              setErrors({ ...errors, mobile: '' });
            }}
            error={!!errors.mobile}
            style={styles.input}
          />
          <HelperText type="error" visible={!!errors.mobile}>
            {errors.mobile}
          </HelperText>

          {/* Address */}
          <TextInput
            label="Address"
            mode="outlined"
            multiline
            numberOfLines={3}
            value={address}
            onChangeText={setAddress}
            style={styles.input}
          />
          <HelperText type="error" visible={false}>
            Address is required
          </HelperText>

          {/* Password */}
          <TextInput
            label="Password *"
            mode="outlined"
            secureTextEntry
            value={password}
            onChangeText={text => {
              setPassword(text);
              setErrors({ ...errors, password: '' });
            }}
            error={!!errors.password}
            style={styles.input}
          />
          <HelperText type="error" visible={!!errors.password}>
            {errors.password}
          </HelperText>

          {/* Confirm Password */}
          <TextInput
            label="Confirm Password *"
            mode="outlined"
            secureTextEntry
            value={confirmPassword}
            onChangeText={text => {
              setConfirmPassword(text);
              setErrors({ ...errors, confirmPassword: '' });
            }}
            error={!!errors.confirmPassword}
            style={styles.input}
          />
          <HelperText type="error" visible={!!errors.confirmPassword}>
            {errors.confirmPassword}
          </HelperText>

          <View style={styles.buttonRow}>
            <Button
              mode="outlined"
              onPress={handleBack}
              style={styles.secondaryButton}
              contentStyle={styles.buttonContent}
              disabled={loading}
            >
              Back
            </Button>
            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.primaryButton}
              contentStyle={styles.buttonContent}
            >
              Register
            </Button>
          </View>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: 24,
    paddingBottom: 32,
  },
  card: {
    padding: 28,
    borderRadius: 16,
  },
  title: {
    marginBottom: 8,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  input: {
    marginBottom: 0,
  },
  button: {
    marginTop: 16,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12, // RN >= 0.71
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
  },
  secondaryButton: {
    flex: 1,
  },
});
