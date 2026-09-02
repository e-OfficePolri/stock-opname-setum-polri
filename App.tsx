import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Modal, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';

// Import objek database Firestore dari file konfigurasi kita
import { db } from './src/firebaseConfig';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// --- 1. LAYAR BERANDA ---
const BerandaScreen = () => {
  const [stats, setStats] = useState({ totalMasuk: 0, totalKeluar: 0, sisaStok: 0 });
  const [loading, setLoading] = useState(true);

  const fetchStatistik = async () => {
    try {
      setLoading(true);
      let masuk = 0;
      let keluar = 0;

      const snapshotMasuk = await getDocs(collection(db, 'barangMasuk'));
      snapshotMasuk.forEach((doc) => {
        masuk += Number(doc.data().jumlah || 0);
      });

      const snapshotKeluar = await getDocs(collection(db, 'barangKeluar'));
      snapshotKeluar.forEach((doc) => {
        keluar += Number(doc.data().jumlah || 0);
      });

      setStats({
        totalMasuk: masuk,
        totalKeluar: keluar,
        sisaStok: masuk - keluar,
      });
    } catch (error) {
      console.error("Gagal mengambil statistik beranda: ", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchStatistik();
  }, []);

  return (
    <ScrollView style={styles.logContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Dashboard Setum Polri</Text>
      <Text style={[styles.subtitle, { marginBottom: 20 }]}>
        Sistem Informasi Manajemen Stock Opname (Firebase)
      </Text>

      <View style={[styles.statCard, { borderLeftColor: '#28a745' }]}>
        <Text style={styles.statLabel}>Akumulasi Barang Masuk</Text>
        <Text style={[styles.statValue, { color: '#28a745' }]}>
          {loading ? '...' : `${stats.totalMasuk} Unit`}
        </Text>
        <Text style={styles.statDesc}>Total seluruh barang yang masuk ke gudang.</Text>
      </View>

      <View style={[styles.statCard, { borderLeftColor: '#d9534f' }]}>
        <Text style={styles.statLabel}>Akumulasi Barang Keluar</Text>
        <Text style={[styles.statValue, { color: '#d9534f' }]}>
          {loading ? '...' : `${stats.totalKeluar} Unit`}
        </Text>
        <Text style={styles.statDesc}>Total seluruh barang yang telah dikeluarkan.</Text>
      </View>

      <View style={[styles.statCard, { borderLeftColor: '#0056b3' }]}>
        <Text style={styles.statLabel}>Estimasi Sisa Stok Bersih</Text>
        <Text style={[styles.statValue, { color: '#0056b3' }]}>
          {loading ? '...' : `${stats.sisaStok} Unit`}
        </Text>
        <Text style={styles.statDesc}>Selisih dari total masuk dikurangi total keluar.</Text>
      </View>
    </ScrollView>
  );
};

// --- LAYAR MANAJEMEN BARANG MASTER ---
const ManajemenBarangScreen = () => {
  const [listBarang, setListBarang] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [kodeBarang, setKodeBarang] = useState('');
  const [namaBaru, setNamaBaru] = useState('');
  const [satuan, setSatuan] = useState('PCS'); 
  
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [itemYangDiedit, setItemYangDiedit] = useState<any>(null);
  const [namaEdit, setNamaEdit] = useState('');
  const [satuanEdit, setSatuanEdit] = useState('');

  const generateKodeOtomatis = (dataBarang: any[]) => {
    if (dataBarang.length === 0) {
      setKodeBarang('STM-1');
      return;
    }

    let maxAngka = 0;
    dataBarang.forEach((item) => {
      if (item.kode && item.kode.startsWith('STM-')) {
        const angkaStr = item.kode.replace('STM-', '');
        const angka = parseInt(angkaStr, 10);
        if (!isNaN(angka) && angka > maxAngka) {
          maxAngka = angka;
        }
      }
    });

    const kodeBerikutnya = `STM-${maxAngka + 1}`;
    setKodeBarang(kodeBerikutnya);
  };

  const fetchBarangMaster = async () => {
    try {
      setLoading(true);
      let tempData: any[] = [];
      const querySnapshot = await getDocs(collection(db, 'barangMaster'));
      querySnapshot.forEach((docItem) => {
        const item = docItem.data();
        tempData.push({
          id: docItem.id,
          kode: item.kodeBarang || '-',
          nama: item.namaBarang,
          satuan: item.satuan || 'PCS',
          stok: item.stokAwal || 0,
        });
      });

      tempData.sort((a, b) => {
        const angkaA = parseInt(a.kode.replace('STM-', '')) || 0;
        const angkaB = parseInt(b.kode.replace('STM-', '')) || 0;
        return angkaA - angkaB; 
      });

      setListBarang(tempData);
      generateKodeOtomatis(tempData);
    } catch (error) {
      console.error("Gagal mengambil data barang: ", error);
      Alert.alert('Error', 'Gagal memuat master data barang.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchBarangMaster();
  }, []);

  const handleTambahBarangMaster = async () => {
    if (!namaBaru.trim() || !kodeBarang.trim()) {
      Alert.alert('Peringatan', 'Nama Barang wajib diisi!');
      return;
    }

    try {
      await addDoc(collection(db, 'barangMaster'), {
        kodeBarang: kodeBarang.trim(),
        namaBarang: namaBaru.trim(),
        satuan: satuan.trim() ? satuan.trim() : 'PCS',
        stokAwal: 0,
        tanggalDibuat: new Date().toISOString(),
      });

      Alert.alert('Sukses', `Barang "${namaBaru}" berhasil ditambahkan!`);
      setNamaBaru('');
      setSatuan('PCS'); 
      fetchBarangMaster(); 
    } catch (error: any) {
      console.error("Gagal menambah barang: ", error);
      Alert.alert('Error', `Gagal menyimpan: ${error.message}`);
    }
  };

  const handleBukaModalEdit = (item: any) => {
    setItemYangDiedit(item);
    setNamaEdit(item.nama);
    setSatuanEdit(item.satuan);
    setModalEditVisible(true);
  };

  const handleSimpanEdit = async () => {
    if (!namaEdit.trim()) {
      Alert.alert('Peringatan', 'Nama barang tidak boleh kosong!');
      return;
    }

    try {
      const docRef = doc(db, 'barangMaster', itemYangDiedit.id);
      
      await updateDoc(docRef, {
        namaBarang: namaEdit.trim(),
        satuan: satuanEdit,
      });

      Alert.alert('Sukses', 'Data barang berhasil diperbarui!');
      setModalEditVisible(false);
      fetchBarangMaster();
    } catch (error: any) {
      console.error("Gagal mengupdate: ", error);
      Alert.alert('Error', `Gagal memperbarui: ${error.message}`);
    }
  };

  const handleDeleteItem = (item: any) => {
    Alert.alert(
      'Konfirmasi Hapus',
      `Yakin ingin menghapus "${item.nama}" dari Master Barang? Data yang dihapus tidak bisa dikembalikan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const docRef = doc(db, 'barangMaster', item.id);
              await deleteDoc(docRef);

              Alert.alert('Sukses', 'Barang berhasil dihapus!');
              fetchBarangMaster();
            } catch (err: any) {
              console.error("Gagal menghapus data: ", err);
              Alert.alert('Error', `Gagal menghapus: ${err.message}`);
            }
          },
        },
      ]
    );
  };

  const renderItemBarang = ({ item }: { item: any }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <Text style={[styles.badge, { backgroundColor: '#0056b3' }]}>
          Stok: {item.stok} {item.satuan.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.logItemName}>[{item.kode}] {item.nama}</Text>

      <View style={styles.actionButtonContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#ffc107', flex: 1, marginRight: 5 }]} 
          onPress={() => handleBukaModalEdit(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#d9534f', flex: 1 }]} 
          onPress={() => handleDeleteItem(item)}
        >
          <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Hapus</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.formContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Manajemen Master Barang</Text>

      <View style={{ backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#E0E0E0' }}>
        <Text style={styles.label}>Tambah Jenis Barang Baru</Text>
        
        <TextInput
          style={[styles.input, { backgroundColor: '#E9ECEF', color: '#6c757d', marginBottom: 10 }]}
          value={kodeBarang}
          editable={false}
          placeholder="Memuat kode..."
        />

        <TextInput
          style={[styles.input, { marginBottom: 10 }]}
          placeholder="Nama Barang..."
          value={namaBaru}
          onChangeText={setNamaBaru}
        />

        <Text style={styles.label}>Pilih Satuan Barang:</Text>
        
        <View style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC', borderRadius: 8, marginBottom: 15, overflow: 'hidden', height: 54, justifyContent: 'center' }}>
          {/* --- PERBAIKAN UKURAN FONT PADA PICKER DI SINI --- */}
          <Picker
            selectedValue={satuan}
            onValueChange={(itemValue: string) => setSatuan(itemValue)}
            style={{ fontSize: 16, color: '#333', borderWidth: 0, width: '100%', height: '100%', outline: 'none' } as any}
            itemStyle={{ fontSize: 16 }}
          >
            <Picker.Item label="PCS" value="PCS" />
            <Picker.Item label="BOX" value="BOX" />
            <Picker.Item label="PACK" value="PACK" />
            <Picker.Item label="ROLL" value="ROLL" />
            <Picker.Item label="LEMBAR" value="LEMBAR" />
            <Picker.Item label="RIM" value="RIM" />
            <Picker.Item label="SET" value="SET" /> 
          </Picker>
        </View>

        <TouchableOpacity style={[styles.button, { marginTop: 0 }]} onPress={handleTambahBarangMaster}>
          <Text style={styles.buttonText}>Simpan ke Master Barang</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { marginBottom: 10 }]}>Daftar Inventaris Gudang:</Text>
      
      {loading ? (
        <Text style={styles.subtitle}>Memuat data...</Text>
      ) : listBarang.length === 0 ? (
        <Text style={styles.subtitle}>Belum ada master barang.</Text>
      ) : (
        <FlatList
          data={listBarang}
          keyExtractor={(item) => item.id}
          renderItem={renderItemBarang}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }} 
        />
      )}

      {/* MODAL UNTUK EDIT DATA BARANG */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalEditVisible}
        onRequestClose={() => setModalEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>Edit Master Barang</Text>
            
            <Text style={styles.label}>Nama Barang:</Text>
            <TextInput
              style={styles.input}
              value={namaEdit}
              onChangeText={setNamaEdit}
              placeholder="Ubah nama barang..."
            />

            <Text style={styles.label}>Satuan:</Text>
            <View style={{ backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC', borderRadius: 8, marginBottom: 15, overflow: 'hidden', height: 54, justifyContent: 'center' }}>
              {/* --- PERBAIKAN UKURAN FONT PADA PICKER DI MODAL JUGA DI SINI --- */}
              <Picker
                selectedValue={satuanEdit}
                onValueChange={(itemValue: string) => setSatuanEdit(itemValue)}
                style={{ fontSize: 16, color: '#333', borderWidth: 0, width: '100%', height: '100%', outline: 'none' } as any}
                itemStyle={{ fontSize: 16 }}
              >
                <Picker.Item label="PCS" value="PCS" />
                <Picker.Item label="BOX" value="BOX" />
                <Picker.Item label="PACK" value="PACK" />
                <Picker.Item label="ROLL" value="ROLL" />
                <Picker.Item label="LEMBAR" value="LEMBAR" />
                <Picker.Item label="RIM" value="RIM" />
                <Picker.Item label="SET" value="SET" />
              </Picker>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#ccc', flex: 1, marginRight: 5, padding: 12 }]} 
                onPress={() => setModalEditVisible(false)}
              >
                <Text style={styles.actionButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#28a745', flex: 1, marginLeft: 5, padding: 12 }]} 
                onPress={handleSimpanEdit}
              >
                <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// --- LAYAR BARANG MASUK ---
const BarangMasukScreen = () => {
  const [namaBarang, setNamaBarang] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSimpanKeFirebase = async () => {
    if (namaBarang.trim() === '' || jumlah.trim() === '') {
      Alert.alert('Peringatan', 'Semua kolom harus diisi!');
      return;
    }

    try {
      setLoading(true);
      
      const docRef = await addDoc(collection(db, 'barangMasuk'), {
        namaBarang: namaBarang,
        jumlah: Number(jumlah),
        tanggal: new Date().toISOString(),
      });

      Alert.alert('Sukses', `Barang ${namaBarang} berhasil disimpan ke Database Firebase!`);
      
      setNamaBarang('');
      setJumlah('');
    } catch (error: any) {
      console.error("Gagal menyimpan data detail: ", error);
      Alert.alert('Error', `Gagal menyimpan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Input Barang Masuk (Firebase)</Text>
      
      <Text style={styles.label}>Nama Barang:</Text>
      <TextInput 
        style={styles.input}
        placeholder="Masukkan nama barang..."
        value={namaBarang}
        onChangeText={setNamaBarang}
      />

      <Text style={styles.label}>Jumlah Masuk:</Text>
      <TextInput 
        style={styles.input}
        placeholder="Contoh: 10"
        keyboardType="numeric"
        value={jumlah}
        onChangeText={setJumlah}
      />

      <TouchableOpacity 
        style={[styles.button, loading && { backgroundColor: '#cccccc' }]} 
        onPress={handleSimpanKeFirebase}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Menyimpan...' : 'Simpan ke Database'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// --- LAYAR BARANG KELUAR ---
const BarangKeluarScreen = () => {
  const [namaBarang, setNamaBarang] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSimpanKeluarKeFirebase = async () => {
    if (namaBarang.trim() === '' || jumlah.trim() === '') {
      Alert.alert('Peringatan', 'Nama barang dan jumlah wajib diisi!');
      return;
    }

    try {
      setLoading(true);
      
      const docRef = await addDoc(collection(db, 'barangKeluar'), {
        namaBarang: namaBarang,
        jumlah: Number(jumlah),
        keterangan: keterangan,
        tanggal: new Date().toISOString(),
      });

      Alert.alert('Sukses', `Barang Keluar: ${namaBarang} sejumlah ${jumlah} berhasil dicatat ke Database!`);
      
      setNamaBarang('');
      setJumlah('');
      setKeterangan('');
    } catch (error: any) {
      console.error("Gagal menyimpan data barang keluar: ", error);
      Alert.alert('Error', `Gagal menyimpan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Input Barang Keluar (Firebase)</Text>
      
      <Text style={styles.label}>Nama Barang:</Text>
      <TextInput 
        style={styles.input}
        placeholder="Masukkan nama barang..."
        value={namaBarang}
        onChangeText={setNamaBarang}
      />

      <Text style={styles.label}>Jumlah Keluar:</Text>
      <TextInput 
        style={styles.input}
        placeholder="Contoh: 5"
        keyboardType="numeric"
        value={jumlah}
        onChangeText={setJumlah}
      />

      <Text style={styles.label}>Keterangan / Keperluan:</Text>
      <TextInput 
        style={styles.input}
        placeholder="Contoh: Untuk Bagian Ops..."
        value={keterangan}
        onChangeText={setKeterangan}
      />

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: '#d9534f' }, loading && { backgroundColor: '#cccccc' }]} 
        onPress={handleSimpanKeluarKeFirebase}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Menyimpan...' : 'Simpan Barang Keluar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// --- LAYAR LOG BARANG ---
const LogBarangScreen = () => {
  const [logData, setLogData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [itemYangDiedit, setItemYangDiedit] = useState<any>(null);
  const [textBaru, setTextBaru] = useState('');

  const fetchLogData = async () => {
    try {
      setLoading(true);
      let tempData: any[] = [];

      const querySnapshotMasuk = await getDocs(collection(db, 'barangMasuk'));
      querySnapshotMasuk.forEach((docItem) => {
        const item = docItem.data();
        tempData.push({
          id: docItem.id,
          jenis: 'MASUK',
          nama: item.namaBarang,
          jumlah: item.jumlah,
          jumlahTampil: `${item.jumlah} Unit/Pcs`,
          tanggal: item.tanggal ? item.tanggal.substring(0, 10) : 'Baru saja',
          koleksiAsal: 'barangMasuk',
        });
      });

      const querySnapshotKeluar = await getDocs(collection(db, 'barangKeluar'));
      querySnapshotKeluar.forEach((docItem) => {
        const item = docItem.data();
        tempData.push({
          id: docItem.id,
          jenis: 'KELUAR',
          nama: item.namaBarang,
          jumlah: item.jumlah,
          jumlahTampil: `${item.jumlah} Unit/Pcs`,
          tanggal: item.tanggal ? item.tanggal.substring(0, 10) : 'Baru saja',
          keterangan: item.keterangan,
          koleksiAsal: 'barangKeluar',
        });
      });

      setLogData(tempData);
    } catch (error) {
      console.error("Gagal mengambil data log: ", error);
      Alert.alert('Error', 'Gagal memuat data riwayat dari database.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLogData();
  }, []);

  const handleBukaModalEdit = (item: any) => {
    setItemYangDiedit(item);
    setTextBaru(item.nama);
    setModalVisible(true);
  };

  const handleSimpanPerubahan = async () => {
    if (!textBaru || textBaru.trim() === '') {
      Alert.alert('Peringatan', 'Nama barang tidak boleh kosong!');
      return;
    }

    try {
      const docRef = doc(db, itemYangDiedit.koleksiAsal, itemYangDiedit.id);
      await updateDoc(docRef, {
        namaBarang: textBaru,
        terakhirDiubah: new Date().toISOString(),
      });

      Alert.alert('Sukses', 'Data barang berhasil diperbarui!');
      setModalVisible(false);
      fetchLogData();
    } catch (err: any) {
      console.error("Gagal mengupdate: ", err);
      Alert.alert('Error', `Gagal memperbarui: ${err.message}`);
    }
  };

  const handleDeleteItem = (item: any) => {
    Alert.alert(
      'Konfirmasi Hapus',
      `Apakah Anda yakin ingin menghapus data "${item.nama}" (${item.jenis})?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              const docRef = doc(db, item.koleksiAsal, item.id);
              await deleteDoc(docRef);

              Alert.alert('Sukses', 'Data berhasil dihapus dari database!');
              fetchLogData();
            } catch (err: any) {
              console.error("Gagal menghapus data: ", err);
              Alert.alert('Error', `Gagal menghapus: ${err.message}`);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <Text style={[
          styles.badge, 
          { backgroundColor: item.jenis === 'MASUK' ? '#28a745' : '#d9534f' }
        ]}>
          {item.jenis}
        </Text>
        <Text style={styles.logDate}>{item.tanggal}</Text>
      </View>
      <Text style={styles.logItemName}>{item.nama}</Text>
      <Text style={styles.logDetail}>Jumlah: {item.jumlahTampil}</Text>
      {item.keterangan ? <Text style={styles.logDetail}>Ket: {item.keterangan}</Text> : null}

      <View style={styles.actionButtonContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#ffc107', flex: 1, marginRight: 5 }]} 
          onPress={() => handleBukaModalEdit(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: '#d9534f', flex: 1 }]} 
          onPress={() => handleDeleteItem(item)}
        >
          <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Hapus</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.logContainer}>
      <Text style={styles.title}>Log Riwayat & Manajemen CRUD</Text>
      
      {loading ? (
        <Text style={styles.subtitle}>Memuat data dari database...</Text>
      ) : logData.length === 0 ? (
        <Text style={styles.subtitle}>Belum ada riwayat transaksi.</Text>
      ) : (
        <FlatList
          data={logData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.title}>Edit Nama Barang</Text>
            <TextInput
              style={styles.input}
              value={textBaru}
              onChangeText={setTextBaru}
              placeholder="Masukkan nama barang baru..."
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#ccc', flex: 1, marginRight: 5, padding: 12 }]} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.actionButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#28a745', flex: 1, marginLeft: 5, padding: 12 }]} 
                onPress={handleSimpanPerubahan}
              >
                <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Simpan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const LaporanScreen = () => {
  const [totalMasuk, setTotalMasuk] = useState(0);
  const [totalKeluar, setTotalKeluar] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLaporanData = async () => {
    try {
      setLoading(true);
      let countMasuk = 0;
      let countKeluar = 0;

      const querySnapshotMasuk = await getDocs(collection(db, 'barangMasuk'));
      querySnapshotMasuk.forEach((doc) => {
        const item = doc.data();
        countMasuk += Number(item.jumlah || 0);
      });

      const querySnapshotKeluar = await getDocs(collection(db, 'barangKeluar'));
      querySnapshotKeluar.forEach((doc) => {
        const item = doc.data();
        countKeluar += Number(item.jumlah || 0);
      });

      setTotalMasuk(countMasuk);
      setTotalKeluar(countKeluar);
    } catch (error) {
      console.error("Gagal memuat laporan: ", error);
      Alert.alert('Error', 'Gagal mengambil data rekapitulasi.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchLaporanData();
  }, []);

  const handleCetakLaporan = () => {
    Alert.alert('Informasi', 'Laporan rekapitulasi inventaris berhasil diproses untuk dicetak.');
  };

  return (
    <View style={styles.formContainer}>
      <Text style={styles.title}>Laporan Rekapitulasi (Firebase)</Text>
      
      <View style={styles.reportCard}>
        <Text style={styles.reportCardTitle}>Periode: Bulan Ini</Text>
        <Text style={styles.reportText}>
          Total Kuantitas Masuk: {loading ? 'Memuat...' : `${totalMasuk} Unit`}
        </Text>
        <Text style={styles.reportText}>
          Total Kuantitas Keluar: {loading ? 'Memuat...' : `${totalKeluar} Unit`}
        </Text>
        <Text style={styles.reportText}>Status Inventaris: Aman / Terkendali</Text>
      </View>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#28a745' }]} onPress={handleCetakLaporan}>
        <Text style={styles.buttonText}>Cetak / Unduh Laporan</Text>
      </TouchableOpacity>
    </View>
  );
};

const ManajemenUserScreen = () => {
  const [userData, setUserData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      let listUser: any[] = [];
      const querySnapshot = await getDocs(collection(db, 'users'));
      querySnapshot.forEach((doc) => {
        const item = doc.data();
        listUser.push({
          id: doc.id,
          nama: item.nama,
          role: item.role,
          status: item.status || 'Aktif',
        });
      });
      setUserData(listUser);
    } catch (error) {
      console.error("Gagal memuat data user: ", error);
      Alert.alert('Error', 'Gagal mengambil daftar petugas.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const handleTambahUser = async () => {
    try {
      const namaBaru = 'Petugas Baru ' + Math.floor(Math.random() * 100);
      await addDoc(collection(db, 'users'), {
        nama: namaBaru,
        role: 'Petugas Input',
        status: 'Aktif',
        tanggalDibuat: new Date().toISOString(),
      });
      Alert.alert('Sukses', `Petugas ${namaBaru} berhasil ditambahkan!`);
      fetchUsers();
    } catch (error) {
      console.error("Gagal menambah user: ", error);
      Alert.alert('Error', 'Gagal menambahkan petugas baru.');
    }
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <Text style={[styles.badge, { backgroundColor: '#0056b3' }]}>{item.role}</Text>
        <Text style={[styles.logDate, { color: '#28a745', fontWeight: 'bold' }]}>{item.status}</Text>
      </View>
      <Text style={styles.logItemName}>{item.nama}</Text>
    </View>
  );

  return (
    <View style={styles.logContainer}>
      <Text style={styles.title}>Manajemen User (Firebase)</Text>
      
      {loading ? (
        <Text style={styles.subtitle}>Memuat daftar petugas...</Text>
      ) : userData.length === 0 ? (
        <Text style={styles.subtitle}>Belum ada data petugas di database.</Text>
      ) : (
        <FlatList
          data={userData}
          keyExtractor={(item) => item.id}
          renderItem={renderUserItem}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={[styles.button, { marginTop: 10 }]} onPress={handleTambahUser}>
        <Text style={styles.buttonText}>+ Tambah Petugas Baru</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- PENGATURAN NAVIGASI BAWAH ---
const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator initialRouteName="Beranda">
        <Tab.Screen name="Beranda" component={BerandaScreen} />
        <Tab.Screen name="Barang" component={ManajemenBarangScreen} />
        <Tab.Screen name="Masuk" component={BarangMasukScreen} />
        <Tab.Screen name="Keluar" component={BarangKeluarScreen} />
        <Tab.Screen name="Log" component={LogBarangScreen} />
        <Tab.Screen name="Laporan" component={LaporanScreen} />
        <Tab.Screen name="User" component={ManajemenUserScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// --- PENGATURAN TAMPILAN (STYLING) ---
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#F5F5F5', 
    padding: 20 
  },
  formContainer: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#F5F5F5', 
    justifyContent: 'center' 
  },
  logContainer: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#F5F5F5' 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    color: '#333', 
    textAlign: 'center' 
  },
  subtitle: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center' 
  },
  label: { 
    fontSize: 16, 
    marginBottom: 5, 
    fontWeight: '600', 
    color: '#444' 
  },
  input: { 
    backgroundColor: '#FFF', 
    borderWidth: 1, 
    borderColor: '#CCC', 
    borderRadius: 8, 
    padding: 12, 
    marginBottom: 15, 
    fontSize: 16 
  },
  button: { 
    backgroundColor: '#0056b3', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginTop: 10 
  },
  buttonText: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  logCard: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  badge: {
    color: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  logDate: {
    color: '#888',
    fontSize: 12,
  },
  logItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  logDetail: {
    fontSize: 14,
    color: '#555',
  },
  reportCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
  },
  reportCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  reportText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
  },
  statCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderLeftWidth: 6,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statDesc: {
    fontSize: 12,
    color: '#888',
  },
  editButton: {
    backgroundColor: '#ffc107',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  editButtonText: {
    color: '#333',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionButtonContainer: {
    flexDirection: 'row',
    marginTop: 12,
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    elevation: 5,
  },
});

