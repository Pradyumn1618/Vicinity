import sodium from 'libsodium-wrappers';
import auth from '@react-native-firebase/auth';
import { getFirestore, setDoc, doc, getDoc } from '@react-native-firebase/firestore';
import * as Keychain from 'react-native-keychain';



// Generate a public/private key pair (for each user)
export const generateKeyPair = () => {
  const keyPair = sodium.crypto_box_keypair();
  return keyPair;
};

// Generate a shared secret using ECDH (Elliptic Curve Diffie-Hellman)
export const generateSharedSecret = (privateKey:string, publicKey:string) => {
    if(!privateKey || !publicKey) {
        throw new Error('Private key or public key is missing');
    }
  return sodium.crypto_scalarmult(
    sodium.from_hex(privateKey),
    sodium.from_hex(publicKey)
  );
};

const storePrivateKeyOnServer = async (userId: string, privateKeyHex: string) => {
    try {
      const idToken = await auth().currentUser?.getIdToken(); // Get the user's ID token for authentication
  
      const response = await fetch('https://vicinity-backend.onrender.com/api/v1/auth/storePrivateKey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`, // Send the ID token in the Authorization header
        },
        body: JSON.stringify({
          userId,
          privateKey: privateKeyHex, // Send the private key to the server
        }),
      });
  
      if (!response.ok) {
        throw new Error(`Failed to store private key on server: ${response.statusText}`);
      }
  
      console.log('Private key successfully stored on the server');
    } catch (error) {
      console.error('Error storing private key on server:', error);
    }
  };


const storePrivateKey = async (userId: string, privateKeyHex: string): Promise<void> => {
    try {
        await Keychain.setGenericPassword(userId, privateKeyHex, {
            service: 'com.vicinity.privatekeys',
        });
        storePrivateKeyOnServer(userId, privateKeyHex);
        console.log('Private key securely stored');
    } catch (error) {
        console.error('Error storing private key', error);
    }
};

const storePublicKey = async (userId:string, publicKeyHex:string) => {
    try {
        const db = getFirestore();
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, { publicKey: publicKeyHex }, { merge: true });
        console.log('Public key securely stored in Firestore');
    } catch (error) {
        console.error('Error storing public key', error);
    }
    }


export const storeKeyPair = (keyPair: any) => {
    const userId = auth().currentUser?.uid;
    if (userId) {
        storePrivateKey(userId, keyPair.privateKey);
        storePublicKey(userId, keyPair.publicKey);
    } else {
        console.error('No user is currently logged in');
    }
};

// AES-GCM encryption using a shared secret
interface EncryptedData {
    cipherText: string;
    nonce: string;
}

export const encryptMessage = (message: string, sharedSecret: Uint8Array): EncryptedData => {
    // Generate a random nonce (12 bytes)
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);

    // Derive an AES key from the shared secret (first 32 bytes)
    const aesKey = sharedSecret.slice(0, 32);

    // Encrypt the message
    const cipherText = sodium.crypto_secretbox_easy(message, nonce, aesKey);

    // Return the encrypted message and nonce
    return {
        cipherText: sodium.to_hex(cipherText),
        nonce: sodium.to_hex(nonce)
    };
};

// AES-GCM decryption using the shared secret

export const decryptMessage = (
    cipherText: string,
    nonce: string,
    privateKey: string,
    senderPublicKey: string
): string => {
    // Derive the shared secret using ECDH (from sender's public key and receiver's private key)
    const sharedSecret = generateSharedSecret(privateKey, senderPublicKey);
    console.log('Shared Secret:', sodium.to_hex(sharedSecret));

    // Derive an AES key from the shared secret (first 32 bytes)
    const aesKey = sharedSecret.slice(0, 32);

    // Convert nonce and cipher text from hex
    const nonceHex = sodium.from_hex(nonce);
    const cipherTextHex = sodium.from_hex(cipherText);

    // Decrypt the message
    const decryptedMessage = sodium.crypto_secretbox_open_easy(cipherTextHex, nonceHex, aesKey);

    if (!decryptedMessage) {
        throw new Error('Decryption failed!');
    }

    return sodium.to_string(decryptedMessage);
};


const KEY_SERVICE = 'com.vicinity.privatekeys';

export const generateAndStoreKeyPairOnce = async (userId:string) => {
  await sodium.ready;

  // 1. Check if key already exists
  const existingKey = await Keychain.getGenericPassword({ service: KEY_SERVICE });
  const db = getFirestore();
  const userRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userRef);
  let publicKeyExists = false;
    if (docSnap.exists) {
        const data = docSnap.data();
        const publicKey = data?.publicKey;
        if (publicKey) {
            console.log('Public key already exists in Firestore:', publicKey);
            publicKeyExists = true;
        } else {
            console.log('No public key found in Firestore');
        }
    }

  if (existingKey && existingKey.username === userId && publicKeyExists) {
    console.log('✅ Private key already exists. Skipping generation.');
    return {
      privateKeyHex: existingKey.password,
      keyAlreadyExists: true,
    };
  }

  // 2. Generate new keypair
  const keyPair = sodium.crypto_box_keypair();
  const privateKeyHex = sodium.to_hex(keyPair.privateKey);
  const publicKeyHex = sodium.to_hex(keyPair.publicKey);

  // 3. Store private key securely
  await Keychain.setGenericPassword(userId, privateKeyHex, { service: KEY_SERVICE });

  console.log('🔐 New key pair generated and stored');

  return {
    privateKeyHex,
    publicKeyHex,
    keyAlreadyExists: false,
  };
};

export const setupKeys = async () => {
    const userId = auth().currentUser?.uid;
    if (!userId) return;
  
    const result = await generateAndStoreKeyPairOnce(userId);
  
    if (!result.keyAlreadyExists) {
        // Store the public key in Firestore
        storeKeyPair({privateKey: result.privateKeyHex, publicKey: result.publicKeyHex});
    }
  };
  
