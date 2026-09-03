import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Modal, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

import { db } from './src/firebaseConfig';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';

// Fungsi bantuan untuk format tanggal YYYY-MM-DD
const getTanggalHariIni = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

// --- 2. LAYAR MANAJEMEN BARANG MASTER ---
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

  const [modalHapusVisible, setModalHapusVisible] = useState(false);
  const [itemYangDihapus, setItemYangDihapus] = useState<any>(null);

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

  const handleBukaModalHapus = (item: any) => {
    setItemYangDihapus(item);
    setModalHapusVisible(true);
  };

  const eksekusiHapusMaster = async () => {
    if (!itemYangDihapus) return;
    try {
      // Hapus dokumen langsung dari koleksi 'barangMaster' di Firebase
      const docRef = doc(db, 'barangMaster', itemYangDihapus.id);
      await deleteDoc(docRef);
      
      setModalHapusVisible(false);
      setItemYangDihapus(null);
      fetchBarangMaster(); // Segarkan ulang daftar master barang
    } catch (err: any) {
      console.error("Gagal menghapus data dari Firebase: ", err);
      Alert.alert('Error', `Gagal menghapus: ${err.message}`);
    }
  };

  const renderItemBarang = ({ item }: { item: any }) => (
    <View style={styles.logCard}>
      <View style={styles.logHeader}>
        <Text style={[styles.badge, { backgroundColor: '#0056b3' }]}>
          Stok: {item.stok} {item.satuan.toUpperCase()}
        </Text>
      </View>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[styles.logItemName, { flex: 1 }]}>[{item.kode}] {item.nama}</Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: '#ffc107' }]} 
            onPress={() => handleBukaModalEdit(item)}
          >
            <Ionicons name="pencil-outline" size={18} color="#333" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: '#d9534f' }]} 
            onPress={() => handleBukaModalHapus(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.formContainer} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={listBarang}
        keyExtractor={(item) => item.id}
        renderItem={renderItemBarang}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }} 
        
        ListHeaderComponent={
          <View>
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
          </View>
        }
        
        ListEmptyComponent={
          loading ? (
            <Text style={styles.subtitle}>Memuat data...</Text>
          ) : (
            <Text style={styles.subtitle}>Belum ada master barang.</Text>
          )
        }
      />

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
      {/* Modal Konfirmasi Hapus Master Barang */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalHapusVisible}
        onRequestClose={() => setModalHapusVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.title, { color: '#d9534f' }]}>Konfirmasi Hapus Permanen</Text>
            <Text style={{ fontSize: 16, marginBottom: 20, textAlign: 'center', color: '#333' }}>
              Apakah Anda yakin ingin menghapus data master "{itemYangDihapus?.nama}" secara permanen?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#ccc', flex: 1, marginRight: 5, padding: 12 }]} 
                onPress={() => setModalHapusVisible(false)}
              >
                <Text style={styles.actionButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#d9534f', flex: 1, marginLeft: 5, padding: 12 }]} 
                onPress={eksekusiHapusMaster}
              >
                <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Ya, Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// --- 3. LAYAR BARANG MASUK (DENGAN KERANJANG) ---
const BarangMasukScreen = () => {
  const [noDokumen, setNoDokumen] = useState('');
  const [tanggalInput, setTanggalInput] = useState(getTanggalHariIni());
  
  const [namaBarang, setNamaBarang] = useState('');
  const [kodeTerpilih, setKodeTerpilih] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [keteranganItem, setKeteranganItem] = useState('');
  
  const [keranjang, setKeranjang] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalHapusVisible, setModalHapusVisible] = useState(false);
  const [itemYangDihapus, setItemYangDihapus] = useState<any>(null);
  
  const [listMaster, setListMaster] = useState<any[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);

  const [modalSearchVisible, setModalSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [listBarangMasukGrouped, setListBarangMasukGrouped] = useState<any[]>([]);
  const [loadingDataMasuk, setLoadingDataMasuk] = useState(true);

  const [modalDetailVisible, setModalDetailVisible] = useState(false);
  const [itemDetail, setItemDetail] = useState<any>(null);

  // State untuk Edit Dokumen & Item di dalamnya
  const [modalEditVisible, setModalEditVisible] = useState(false);
  const [editNoDokumen, setEditNoDokumen] = useState('');
  const [editTanggal, setEditTanggal] = useState('');
  const [editItemsList, setEditItemsList] = useState<any[]>([]);

  // State pencarian barang khusus untuk Modal Edit (jika ingin menambah barang baru)
  const [modalSearchEditVisible, setModalSearchEditVisible] = useState(false);
  const [searchEditText, setSearchEditText] = useState('');

  const [modalHapusDbVisible, setModalHapusDbVisible] = useState(false);
  const [itemHapusDb, setItemHapusDb] = useState<any>(null);

  const fetchMasterBarang = async () => {
    try {
      setMasterLoading(true);
      const querySnapshot = await getDocs(collection(db, 'barangMaster'));
      let tempData: any[] = [];
      querySnapshot.forEach((docItem) => {
        const item = docItem.data();
        tempData.push({ id: docItem.id, nama: item.namaBarang, kode: item.kodeBarang || '-' });
      });
      tempData.sort((a, b) => {
        const angkaA = parseInt(a.kode.replace('STM-', '')) || 0;
        const angkaB = parseInt(b.kode.replace('STM-', '')) || 0;
        return angkaA - angkaB; 
      });
      setListMaster(tempData);
    } catch (error) {
      Alert.alert('Error', 'Gagal memuat daftar barang.');
    } finally {
      setMasterLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMasterBarang();
  }, []);

  const handlePilihBarang = (item: any) => {
    setNamaBarang(item.nama);
    setKodeTerpilih(item.kode);
    setModalSearchVisible(false);
    setSearchText('');
  };

  const filteredMaster = listMaster.filter(item => 
    item.nama.toLowerCase().includes(searchText.toLowerCase()) || 
    item.kode.toLowerCase().includes(searchText.toLowerCase())
  );

  const filteredMasterEdit = listMaster.filter(item => 
    item.nama.toLowerCase().includes(searchEditText.toLowerCase()) || 
    item.kode.toLowerCase().includes(searchEditText.toLowerCase())
  );

  const handleTambahKeKeranjang = () => {
    if (!namaBarang || !jumlah || Number(jumlah) <= 0) {
      Alert.alert('Peringatan', 'Pilih nama barang dan masukkan jumlah!');
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      kodeBarang: kodeTerpilih,
      namaBarang: namaBarang,
      jumlah: Number(jumlah),
      keterangan: keteranganItem.trim(),
    };
    setKeranjang([...keranjang, newItem]);
    setNamaBarang(''); setKodeTerpilih(''); setJumlah(''); setKeteranganItem('');
  };

  const handleBukaModalHapus = (item: any) => {
    setItemYangDihapus(item);
    setModalHapusVisible(true);
  };

  const eksekusiHapusKeranjang = () => {
    if (itemYangDihapus) {
      setKeranjang(keranjang.filter(item => item.id !== itemYangDihapus.id));
      setModalHapusVisible(false);
      setItemYangDihapus(null);
    }
  };

  const handleSimpanSemuaKeFirebase = async () => {
    if (!noDokumen.trim() || !tanggalInput.trim()) {
      Alert.alert('Peringatan', 'No. Dokumen dan Tanggal wajib diisi!');
      return;
    }
    if (keranjang.length === 0) {
      Alert.alert('Peringatan', 'Keranjang kosong!');
      return;
    }
    try {
      setLoading(true);
      for (let item of keranjang) {
        await addDoc(collection(db, 'barangMasuk'), {
          noDokumen: noDokumen.trim(),
          tanggal: tanggalInput.trim(),
          kodeBarang: item.kodeBarang,
          namaBarang: item.namaBarang,
          jumlah: item.jumlah,
          keterangan: item.keterangan,
          createdAt: new Date().toISOString(),
        });
      }
      Alert.alert('Sukses', 'Data berhasil disimpan!');
      setNoDokumen(''); setTanggalInput(getTanggalHariIni()); setKeranjang([]);
      fetchBarangMasuk(); 
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBarangMasuk = async () => {
    try {
      setLoadingDataMasuk(true);
      const querySnapshot = await getDocs(collection(db, 'barangMasuk'));
      let tempData: any[] = [];
      querySnapshot.forEach((docItem) => {
        tempData.push({ id: docItem.id, ...docItem.data() });
      });

      const groupedData = tempData.reduce((acc: any, curr: any) => {
        const noDok = curr.noDokumen || '-';
        if (!acc[noDok]) {
          acc[noDok] = {
            noDokumen: noDok,
            tanggal: curr.tanggal || '-',
            totalItemTypes: 0,
            totalJumlah: 0,
            keteranganUtama: curr.keterangan || '-',
            items: [],
          };
        }
        acc[noDok].items.push(curr);
        acc[noDok].totalItemTypes += 1;
        acc[noDok].totalJumlah += Number(curr.jumlah) || 0;
        
        if ((!acc[noDok].keteranganUtama || acc[noDok].keteranganUtama === '-') && curr.keterangan) {
          acc[noDok].keteranganUtama = curr.keterangan;
        }

        return acc;
      }, {});

      setListBarangMasukGrouped(Object.values(groupedData));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingDataMasuk(false);
    }
  };

  React.useEffect(() => {
    fetchBarangMasuk();
  }, []);

  const handleBukaEdit = (groupItem: any) => {
    setEditNoDokumen(groupItem.noDokumen);
    setEditTanggal(groupItem.tanggal);
    setEditItemsList(JSON.parse(JSON.stringify(groupItem.items)));
    setModalEditVisible(true);
  };

  const handleUbahItemEdit = (index: number, field: string, value: any) => {
    const updatedItems = [...editItemsList];
    updatedItems[index][field] = value;
    setEditItemsList(updatedItems);
  };

  // Fungsi untuk menambah item baru langsung di dalam modal edit
  const handleTambahItemBaruDiEdit = (itemMaster: any) => {
    const newItem = {
      id: null, // id null menandakan ini item baru yang belum ada di database firestore
      kodeBarang: itemMaster.kode,
      namaBarang: itemMaster.nama,
      jumlah: 1,
      keterangan: '',
    };
    setEditItemsList([...editItemsList, newItem]);
    setModalSearchEditVisible(false);
    setSearchEditText('');
  };

  // Fungsi untuk menghapus salah satu item dari daftar edit
  const handleHapusItemDariEdit = (index: number) => {
    const updatedItems = editItemsList.filter((_, i) => i !== index);
    setEditItemsList(updatedItems);
  };

  const handleSimpanEdit = async () => {
    if (!editNoDokumen.trim() || !editTanggal.trim()) {
      Alert.alert('Peringatan', 'Nomor dokumen dan tanggal wajib diisi!');
      return;
    }
    if (editItemsList.length === 0) {
      Alert.alert('Peringatan', 'Dokumen harus memiliki minimal 1 item barang!');
      return;
    }
    try {
      setLoading(true);
      
      // Ambil daftar ID lama yang ada pada dokumen ini untuk mendeteksi item yang dihapus
      const groupAwal = listBarangMasukGrouped.find(g => g.noDokumen === editNoDokumen);
      
      // Simpan/Perbarui item ke Firebase
      for (let item of editItemsList) {
        if (item.id) {
          // Update data item yang sudah ada
          const docRef = doc(db, 'barangMasuk', item.id);
          await updateDoc(docRef, {
            noDokumen: editNoDokumen.trim(),
            tanggal: editTanggal.trim(),
            namaBarang: item.namaBarang,
            kodeBarang: item.kodeBarang,
            jumlah: Number(item.jumlah) || 0,
            keterangan: item.keterangan || '',
          });
        } else {
          // Tambah dokumen baru jika item tersebut baru ditambahkan lewat modal edit
          await addDoc(collection(db, 'barangMasuk'), {
            noDokumen: editNoDokumen.trim(),
            tanggal: editTanggal.trim(),
            kodeBarang: item.kodeBarang,
            namaBarang: item.namaBarang,
            jumlah: Number(item.jumlah) || 0,
            keterangan: item.keterangan || '',
            createdAt: new Date().toISOString(),
          });
        }
      }

      // Hapus dari database item lama yang sudah dibuang oleh user di modal edit
      if (groupAwal && groupAwal.items) {
        const currentIds = editItemsList.filter(i => i.id !== null).map(i => i.id);
        for (let oldItem of groupAwal.items) {
          if (!currentIds.includes(oldItem.id)) {
            await deleteDoc(doc(db, 'barangMasuk', oldItem.id));
          }
        }
      }

      Alert.alert('Sukses', 'Perubahan data berhasil disimpan.');
      setModalEditVisible(false);
      fetchBarangMasuk();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBukaHapusDb = (groupItem: any) => {
    setItemHapusDb(groupItem);
    setModalHapusDbVisible(true);
  };

  const eksekusiHapusDb = async () => {
    if (!itemHapusDb) return;
    try {
      for (let item of itemHapusDb.items) {
        const docRef = doc(db, 'barangMasuk', item.id);
        await deleteDoc(docRef);
      }
      setModalHapusDbVisible(false);
      setItemHapusDb(null);
      fetchBarangMasuk();
      Alert.alert('Sukses', 'Dokumen berhasil dihapus.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.logContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Input Barang Masuk</Text>
      
      <Text style={styles.label}>No. Dokumen / No. Nota / Surmas:</Text>
      <TextInput style={styles.input} placeholder="Contoh: B/ND-102/IX/2026" value={noDokumen} onChangeText={setNoDokumen} />

      <Text style={styles.label}>Tanggal Dokumen (YYYY-MM-DD):</Text>
      <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={tanggalInput} onChangeText={setTanggalInput} />

      <View style={{ backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#E0E0E0' }}>
        <Text style={[styles.label, { color: '#0056b3' }]}>Form Tambah Item Barang</Text>
        <Text style={styles.label}>Kode Barang:</Text>
        <TextInput style={[styles.input, { backgroundColor: '#E9ECEF', color: '#6c757d' }]} value={kodeTerpilih} editable={false} placeholder="Pilih barang terlebih dahulu..." />

        <Text style={styles.label}>Pilih Nama Barang:</Text>
        <TouchableOpacity style={styles.dropdownSelector} onPress={() => setModalSearchVisible(true)} disabled={masterLoading || listMaster.length === 0}>
          <Text style={{ fontSize: 16, color: namaBarang ? '#333' : '#888' }}>
            {masterLoading ? 'Memuat...' : listMaster.length === 0 ? 'Master kosong!' : namaBarang ? namaBarang : 'Ketuk mencari barang...'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>

        <Text style={styles.label}>Jumlah Masuk:</Text>
        <TextInput style={styles.input} placeholder="Contoh: 10" keyboardType="numeric" value={jumlah} onChangeText={setJumlah} />

        <Text style={styles.label}>Keterangan (Opsional):</Text>
        <TextInput style={styles.input} placeholder="Contoh: Kondisi baik..." value={keteranganItem} onChangeText={setKeteranganItem} />

        <TouchableOpacity style={[styles.button, { backgroundColor: '#28a745', marginTop: 5 }]} onPress={handleTambahKeKeranjang}>
          <Text style={styles.buttonText}>+ Masukkan ke Daftar</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Daftar Barang Masuk ({keranjang.length}):</Text>
      {keranjang.length === 0 ? (
        <Text style={[styles.subtitle, { marginBottom: 15, textAlign: 'left', fontStyle: 'italic' }]}>Belum ada item ditambahkan.</Text>
      ) : (
        keranjang.map((item) => (
          <View key={item.id} style={[styles.logCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logItemName}>[{item.kodeBarang}] {item.namaBarang}</Text>
              <Text style={styles.logDetail}>Jumlah: {item.jumlah}</Text>
            </View>
            <TouchableOpacity style={[styles.iconButton, { backgroundColor: '#d9534f' }]} onPress={() => handleBukaModalHapus(item)}>
              <Ionicons name="trash-outline" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity style={[styles.button, { marginBottom: 30, marginTop: 15 }, loading && { backgroundColor: '#cccccc' }]} onPress={handleSimpanSemuaKeFirebase} disabled={loading || keranjang.length === 0}>
        <Text style={styles.buttonText}>{loading ? 'Menyimpan...' : 'Simpan Semua ke Database'}</Text>
      </TouchableOpacity>

      {/* --- TABEL RIWAYAT TRANSAKSI PENUH MEMANJANG (100%) --- */}
      <View style={{ marginBottom: 40, width: '100%' }}>
        <Text style={[styles.title, { fontSize: 18, textAlign: 'left', marginBottom: 10 }]}>
          Riwayat Transaksi ({listBarangMasukGrouped.length} Dokumen)
        </Text>

        {loadingDataMasuk ? (
          <Text style={styles.subtitle}>Memuat riwayat...</Text>
        ) : listBarangMasukGrouped.length === 0 ? (
          <Text style={styles.subtitle}>Belum ada riwayat transaksi.</Text>
        ) : (
          <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} style={{ width: '100%' }}>
            <View style={{ minWidth: '100%', width: '100%', backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', overflow: 'hidden' }}>
              
              <View style={{ flexDirection: 'row', backgroundColor: '#f4f4f4', borderBottomWidth: 1, borderColor: '#ddd', paddingVertical: 12 }}>
                <Text style={{ width: 50, textAlign: 'center', fontWeight: 'bold', color: '#333' }}>NO.</Text>
                <Text style={{ width: 120, textAlign: 'center', fontWeight: 'bold', color: '#333' }}>TANGGAL</Text>
                <Text style={{ flex: 2, minWidth: 200, paddingHorizontal: 10, fontWeight: 'bold', color: '#333' }}>NO. DOKUMEN</Text>
                <Text style={{ width: 140, textAlign: 'center', fontWeight: 'bold', color: '#333' }}>JML BARANG</Text>
                <Text style={{ flex: 2, minWidth: 180, paddingHorizontal: 10, fontWeight: 'bold', color: '#333' }}>KETERANGAN</Text>
                <Text style={{ width: 120, textAlign: 'center', fontWeight: 'bold', color: '#333' }}>AKSI</Text>
              </View>

              {listBarangMasukGrouped.map((row, index) => (
                <View key={index} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12, alignItems: 'center' }}>
                  <Text style={{ width: 50, textAlign: 'center', color: '#555' }}>{index + 1}</Text>
                  <Text style={{ width: 120, textAlign: 'center', color: '#555' }}>{row.tanggal}</Text>
                  <Text style={{ flex: 2, minWidth: 200, paddingHorizontal: 10, color: '#0056b3', fontWeight: 'bold' }}>{row.noDokumen}</Text>
                  
                  <View style={{ width: 140, alignItems: 'center' }}>
                    <Text style={{ color: '#555', fontWeight: 'bold' }}>{row.totalItemTypes} Macam</Text>
                    <Text style={{ color: '#888', fontSize: 12 }}>({row.totalJumlah} Unit)</Text>
                  </View>

                  <Text style={{ flex: 2, minWidth: 180, paddingHorizontal: 10, color: '#555', fontSize: 12 }} numberOfLines={1}>
                    {row.keteranganUtama}
                  </Text>
                  
                  <View style={{ width: 120, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                    <TouchableOpacity style={[styles.iconButton, { backgroundColor: '#17a2b8' }]} onPress={() => { setItemDetail(row); setModalDetailVisible(true); }}>
                      <Ionicons name="eye-outline" size={16} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconButton, { backgroundColor: '#ffc107' }]} onPress={() => handleBukaEdit(row)}>
                      <Ionicons name="pencil-outline" size={16} color="#333" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.iconButton, { backgroundColor: '#d9534f' }]} onPress={() => handleBukaHapusDb(row)}>
                      <Ionicons name="trash-outline" size={16} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

            </View>
          </ScrollView>
        )}
      </View>

      {/* --- MODAL PENCARIAN UTAMA --- */}
      <Modal visible={modalSearchVisible} animationType="slide" transparent={true} onRequestClose={() => setModalSearchVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.title}>Cari Barang</Text>
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
              <TextInput style={styles.searchInput} placeholder="Ketik nama atau kode..." value={searchText} onChangeText={setSearchText} autoFocus={true} />
            </View>
            <FlatList data={filteredMaster} keyExtractor={(item) => item.id} renderItem={({item}) => (
              <TouchableOpacity style={styles.searchListItem} onPress={() => handlePilihBarang(item)}>
                <Text style={styles.searchListCode}>[{item.kode}]</Text><Text style={styles.searchListName}>{item.nama}</Text>
              </TouchableOpacity>
            )}/>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#d9534f', marginTop: 15 }]} onPress={() => setModalSearchVisible(false)}>
              <Text style={styles.buttonText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL PENCARIAN TAMBAH BARANG DI EDIT --- */}
      <Modal visible={modalSearchEditVisible} animationType="slide" transparent={true} onRequestClose={() => setModalSearchEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.title}>Pilih Barang Tambahan</Text>
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
              <TextInput style={styles.searchInput} placeholder="Cari master barang..." value={searchEditText} onChangeText={setSearchEditText} autoFocus={true} />
            </View>
            <FlatList data={filteredMasterEdit} keyExtractor={(item) => item.id} renderItem={({item}) => (
              <TouchableOpacity style={styles.searchListItem} onPress={() => handleTambahItemBaruDiEdit(item)}>
                <Text style={styles.searchListCode}>[{item.kode}]</Text><Text style={styles.searchListName}>{item.nama}</Text>
              </TouchableOpacity>
            )}/>
            <TouchableOpacity style={[styles.button, { backgroundColor: '#d9534f', marginTop: 15 }]} onPress={() => setModalSearchEditVisible(false)}>
              <Text style={styles.buttonText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL KONFIRMASI HAPUS KERANJANG --- */}
      <Modal animationType="fade" transparent={true} visible={modalHapusVisible} onRequestClose={() => setModalHapusVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.title, { color: '#d9534f' }]}>Konfirmasi Hapus</Text>
            <Text style={{ fontSize: 16, marginBottom: 20, textAlign: 'center', color: '#333' }}>Hapus dari daftar masuk?</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#ccc', flex: 1, marginRight: 5, padding: 12 }]} onPress={() => setModalHapusVisible(false)}><Text style={styles.actionButtonText}>Batal</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#d9534f', flex: 1, marginLeft: 5, padding: 12 }]} onPress={eksekusiHapusKeranjang}><Text style={[styles.actionButtonText, { color: '#FFF' }]}>Hapus</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- MODAL DETAIL --- */}
      <Modal visible={modalDetailVisible} animationType="slide" transparent={true} onRequestClose={() => setModalDetailVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.title}>Detail Dokumen</Text>
            <Text style={[styles.reportText, { fontWeight: 'bold' }]}>No. Dokumen: {itemDetail?.noDokumen}</Text>
            <Text style={styles.reportText}>Tanggal: {itemDetail?.tanggal}</Text>
            <Text style={{ marginTop: 15, fontWeight: 'bold', color: '#333', marginBottom: 5 }}>Daftar Barang:</Text>
            
            <ScrollView style={{ maxHeight: 250, width: '100%' }}>
              {itemDetail?.items.map((brg: any, index: number) => (
                <View key={index} style={{ backgroundColor: '#f9f9f9', padding: 10, borderRadius: 5, marginBottom: 8, borderWidth: 1, borderColor: '#eee' }}>
                  <Text style={{ fontWeight: 'bold', color: '#0056b3' }}>[{brg.kodeBarang}] {brg.namaBarang}</Text>
                  <Text style={{ color: '#555', fontSize: 13 }}>Jumlah: {brg.jumlah} Unit</Text>
                  {brg.keterangan ? <Text style={{ color: '#777', fontSize: 12, fontStyle: 'italic' }}>Ket: {brg.keterangan}</Text> : null}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={[styles.button, { marginTop: 15, width: '100%' }]} onPress={() => setModalDetailVisible(false)}>
              <Text style={styles.buttonText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL EDIT DOKUMEN & KELOLA BARANG --- */}
      <Modal visible={modalEditVisible} animationType="slide" transparent={true} onRequestClose={() => setModalEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%', maxHeight: '85%' }]}>
            <Text style={styles.title}>Edit Dokumen & Barang</Text>
            
            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              {/* Form edit dokumen dan daftar item... */}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, width: '100%' }}>
              {/* Tombol aksi batal & simpan... */}
            </View>
          </View>
        </View>

        {/* --- MODAL PENCARIAN TAMBAH BARANG DI EDIT (HARUS DI DALAM SINI) --- */}
        <Modal visible={modalSearchEditVisible} animationType="slide" transparent={true} onRequestClose={() => setModalSearchEditVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { height: '80%' }]}>
              <Text style={styles.title}>Pilih Barang Tambahan</Text>
              <View style={styles.searchBarContainer}>
                <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
                <TextInput style={styles.searchInput} placeholder="Cari master barang..." value={searchEditText} onChangeText={setSearchEditText} autoFocus={true} />
              </View>
              <FlatList data={filteredMasterEdit} keyExtractor={(item) => item.id} renderItem={({item}) => (
                <TouchableOpacity style={styles.searchListItem} onPress={() => handleTambahItemBaruDiEdit(item)}>
                  <Text style={styles.searchListCode}>[{item.kode}]</Text><Text style={styles.searchListName}>{item.nama}</Text>
                </TouchableOpacity>
              )}/>
              <TouchableOpacity style={[styles.button, { backgroundColor: '#d9534f', marginTop: 15 }]} onPress={() => setModalSearchEditVisible(false)}>
                <Text style={styles.buttonText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Modal>
      
      {/* --- MODAL KONFIRMASI HAPUS DARI DATABASE --- */}
      <Modal visible={modalHapusDbVisible} animationType="fade" transparent={true} onRequestClose={() => setModalHapusDbVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.title, { color: '#d9534f' }]}>Hapus Dokumen</Text>
            <Text style={{ fontSize: 15, marginBottom: 20, textAlign: 'center', color: '#333' }}>
              Yakin ingin menghapus seluruh data pada Dokumen <Text style={{fontWeight: 'bold'}}>{itemHapusDb?.noDokumen}</Text>?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#ccc', flex: 1, marginRight: 5, padding: 12 }]} onPress={() => setModalHapusDbVisible(false)}>
                <Text style={styles.actionButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#d9534f', flex: 1, marginLeft: 5, padding: 12 }]} onPress={eksekusiHapusDb}>
                <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Ya, Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// --- 4. LAYAR BARANG KELUAR (DENGAN KERANJANG) ---
const BarangKeluarScreen = () => {
  const [noDokumen, setNoDokumen] = useState('');
  const [tanggalInput, setTanggalInput] = useState(getTanggalHariIni());
  
  const [namaBarang, setNamaBarang] = useState('');
  const [kodeTerpilih, setKodeTerpilih] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  
  // Keranjang untuk barang keluar
  const [keranjang, setKeranjang] = useState<any[]>([]);
  const [modalHapusVisible, setModalHapusVisible] = useState(false);
  const [itemYangDihapus, setItemYangDihapus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [listMaster, setListMaster] = useState<any[]>([]);
  const [masterLoading, setMasterLoading] = useState(true);

  const [modalSearchVisible, setModalSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  const fetchMasterBarang = async () => {
    try {
      setMasterLoading(true);
      const querySnapshot = await getDocs(collection(db, 'barangMaster'));
      let tempData: any[] = [];
      
      querySnapshot.forEach((docItem) => {
        const item = docItem.data();
        tempData.push({
          id: docItem.id,
          nama: item.namaBarang,
          kode: item.kodeBarang || '-',
        });
      });
      
      tempData.sort((a, b) => {
        const angkaA = parseInt(a.kode.replace('STM-', '')) || 0;
        const angkaB = parseInt(b.kode.replace('STM-', '')) || 0;
        return angkaA - angkaB; 
      });

      setListMaster(tempData);
    } catch (error) {
      console.error("Gagal mengambil master barang: ", error);
      Alert.alert('Error', 'Gagal memuat daftar barang dari master.');
    } finally {
      setMasterLoading(false);
    }
  };

  React.useEffect(() => {
    fetchMasterBarang();
  }, []);

  const handlePilihBarang = (item: any) => {
    setNamaBarang(item.nama);
    setKodeTerpilih(item.kode);
    setModalSearchVisible(false);
    setSearchText('');
  };

  const filteredMaster = listMaster.filter(item => 
    item.nama.toLowerCase().includes(searchText.toLowerCase()) || 
    item.kode.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleTambahKeKeranjang = () => {
    if (!namaBarang || !jumlah || Number(jumlah) <= 0) {
      Alert.alert('Peringatan', 'Pilih nama barang dan masukkan jumlah keluar!');
      return;
    }

    const newItem = {
      id: Date.now().toString(),
      kodeBarang: kodeTerpilih,
      namaBarang: namaBarang,
      jumlah: Number(jumlah),
      keterangan: keterangan.trim(),
    };

    setKeranjang([...keranjang, newItem]);
    setNamaBarang('');
    setKodeTerpilih('');
    setJumlah('');
    setKeterangan('');
  };

  // Fungsi untuk membuka kotak konfirmasi
  const handleBukaModalHapus = (item: any) => {
    setItemYangDihapus(item);
    setModalHapusVisible(true);
  };

  // Fungsi untuk mengeksekusi penghapusan dari keranjang
  const eksekusiHapusKeranjang = () => {
    if (itemYangDihapus) {
      setKeranjang(keranjang.filter(item => item.id !== itemYangDihapus.id));
      setModalHapusVisible(false); // Tutup modal
      setItemYangDihapus(null);    // Kosongkan data sementara
    }
  };

  const handleSimpanKeluarSemuaKeFirebase = async () => {
    if (!noDokumen.trim() || !tanggalInput.trim()) {
      Alert.alert('Peringatan', 'No. Dokumen dan Tanggal wajib diisi!');
      return;
    }

    if (keranjang.length === 0) {
      Alert.alert('Peringatan', 'Keranjang masih kosong. Tambahkan minimal satu barang!');
      return;
    }

    try {
      setLoading(true);
      
      for (let item of keranjang) {
        await addDoc(collection(db, 'barangKeluar'), {
          noDokumen: noDokumen.trim(),
          tanggal: tanggalInput.trim(),
          kodeBarang: item.kodeBarang,
          namaBarang: item.namaBarang,
          jumlah: item.jumlah,
          keterangan: item.keterangan,
          createdAt: new Date().toISOString(),
        });
      }

      Alert.alert('Sukses', `Semua barang keluar dengan No. Dokumen ${noDokumen} berhasil dicatat!`);
      
      setNoDokumen('');
      setTanggalInput(getTanggalHariIni());
      setKeranjang([]);
    } catch (error: any) {
      console.error("Gagal menyimpan data barang keluar: ", error);
      Alert.alert('Error', `Gagal menyimpan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.logContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Input Barang Keluar (Firebase)</Text>
      
      <Text style={styles.label}>No. Dokumen / SPP / Bon Pengeluaran:</Text>
      <TextInput 
        style={styles.input}
        placeholder="Contoh: SK/045/IX/2026/Setum"
        value={noDokumen}
        onChangeText={setNoDokumen}
      />

      <Text style={styles.label}>Tanggal Pengeluaran (YYYY-MM-DD):</Text>
      <TextInput 
        style={styles.input}
        placeholder="YYYY-MM-DD"
        value={tanggalInput}
        onChangeText={setTanggalInput}
      />

      <View style={{ backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#E0E0E0' }}>
        <Text style={[styles.label, { color: '#d9534f' }]}>Form Tambah Item Barang Keluar</Text>

        <Text style={styles.label}>Kode Barang:</Text>
        <TextInput 
          style={[styles.input, { backgroundColor: '#E9ECEF', color: '#6c757d' }]}
          value={kodeTerpilih}
          editable={false}
          placeholder="Pilih barang terlebih dahulu..."
        />

        <Text style={styles.label}>Pilih Nama Barang:</Text>
        <TouchableOpacity 
          style={styles.dropdownSelector}
          onPress={() => setModalSearchVisible(true)}
          disabled={masterLoading || listMaster.length === 0}
        >
          <Text style={{ fontSize: 16, color: namaBarang ? '#333' : '#888' }}>
            {masterLoading ? 'Memuat daftar barang...' : 
             listMaster.length === 0 ? 'Master barang kosong. Tambah dulu!' : 
             namaBarang ? namaBarang : 'Ketuk untuk mencari barang...'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>

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
          style={[styles.button, { backgroundColor: '#d9534f', marginTop: 5 }]} 
          onPress={handleTambahKeKeranjang}
        >
          <Text style={styles.buttonText}>+ Masukkan ke Daftar</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Daftar Barang Keluar ({keranjang.length}):</Text>
      {keranjang.length === 0 ? (
        <Text style={[styles.subtitle, { marginBottom: 15, textAlign: 'left', fontStyle: 'italic' }]}>
          Belum ada item ditambahkan ke daftar ini.
        </Text>
      ) : (
        keranjang.map((item) => (
          <View key={item.id} style={[styles.logCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logItemName}>[{item.kodeBarang}] {item.namaBarang}</Text>
              <Text style={styles.logDetail}>Jumlah: {item.jumlah} Unit</Text>
              {item.keterangan ? <Text style={styles.logDetail}>Ket: {item.keterangan}</Text> : null}
            </View>
            <TouchableOpacity 
              style={[styles.iconButton, { backgroundColor: '#d9534f' }]} 
              onPress={() => handleBukaModalHapus(item)}
            >
              <Ionicons name="trash-outline" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        ))
      )}

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: '#d9534f', marginBottom: 30, marginTop: 15 }, loading && { backgroundColor: '#cccccc' }]} 
        onPress={handleSimpanKeluarSemuaKeFirebase}
        disabled={loading || keranjang.length === 0}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Menyimpan...' : 'Simpan Semua Barang Keluar'}
        </Text>
      </TouchableOpacity>

      {/* Modal Pencarian Barang */}
      <Modal visible={modalSearchVisible} animationType="slide" transparent={true} onRequestClose={() => setModalSearchVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '80%' }]}>
            <Text style={styles.title}>Cari Barang Keluar</Text>
            
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
              <TextInput 
                style={styles.searchInput}
                placeholder="Ketik nama atau kode barang..."
                value={searchText}
                onChangeText={setSearchText}
                autoFocus={true}
              />
            </View>

            <FlatList 
              data={filteredMaster}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({item}) => (
                <TouchableOpacity style={styles.searchListItem} onPress={() => handlePilihBarang(item)}>
                  <Text style={styles.searchListCode}>[{item.kode}]</Text>
                  <Text style={styles.searchListName}>{item.nama}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', marginTop: 20, color: '#888' }}>Barang tidak ditemukan.</Text>
              }
            />

            <TouchableOpacity 
              style={[styles.button, { backgroundColor: '#d9534f', marginTop: 15 }]} 
              onPress={() => setModalSearchVisible(false)}
            >
              <Text style={styles.buttonText}>Tutup</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Modal Konfirmasi Hapus Keranjang */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalHapusVisible}
        onRequestClose={() => setModalHapusVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.title, { color: '#d9534f' }]}>Konfirmasi Hapus</Text>
            <Text style={{ fontSize: 16, marginBottom: 20, textAlign: 'center', color: '#333' }}>
              Apakah Anda yakin ingin menghapus "{itemYangDihapus?.namaBarang}" dari daftar keluar?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#ccc', flex: 1, marginRight: 5, padding: 12 }]} 
                onPress={() => setModalHapusVisible(false)}
              >
                <Text style={styles.actionButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#d9534f', flex: 1, marginLeft: 5, padding: 12 }]} 
                onPress={eksekusiHapusKeranjang}
              >
                <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Ya, Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

// --- 5. LAYAR LOG BARANG ---
const LogBarangScreen = () => {
  const [logData, setLogData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [itemYangDiedit, setItemYangDiedit] = useState<any>(null);
  const [textBaru, setTextBaru] = useState('');
  const [modalHapusVisible, setModalHapusVisible] = useState(false);
  const [itemYangDihapus, setItemYangDihapus] = useState<any>(null);

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
          noDokumen: item.noDokumen || '-',
          nama: item.namaBarang,
          jumlah: item.jumlah,
          jumlahTampil: `${item.jumlah} Unit/Pcs`,
          tanggal: item.tanggal || (item.createdAt ? item.createdAt.substring(0, 10) : '-'),
          keterangan: item.keterangan,
          koleksiAsal: 'barangMasuk',
        });
      });

      const querySnapshotKeluar = await getDocs(collection(db, 'barangKeluar'));
      querySnapshotKeluar.forEach((docItem) => {
        const item = docItem.data();
        tempData.push({
          id: docItem.id,
          jenis: 'KELUAR',
          noDokumen: item.noDokumen || '-',
          nama: item.namaBarang,
          jumlah: item.jumlah,
          jumlahTampil: `${item.jumlah} Unit/Pcs`,
          tanggal: item.tanggal || (item.createdAt ? item.createdAt.substring(0, 10) : '-'),
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
    setItemYangDihapus(item);
    setModalHapusVisible(true);
  };

  const eksekusiHapus = async () => {
    if (!itemYangDihapus) return;

    try {
      const docRef = doc(db, itemYangDihapus.koleksiAsal, itemYangDihapus.id);
      await deleteDoc(docRef);

      setModalHapusVisible(false); // Tutup kotak konfirmasi
      setItemYangDihapus(null);    // Kosongkan data yang dipilih
      fetchLogData();              // Refresh daftar log
      
    } catch (err: any) {
      console.error("Gagal menghapus: ", err);
      Alert.alert('Error', `Gagal menghapus: ${err.message}`);
    }
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

      <Text style={{ fontSize: 12, color: '#0056b3', fontWeight: 'bold', marginBottom: 2 }}>
        No. Dok: {item.noDokumen}
      </Text>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.logItemName}>{item.nama}</Text>
          <Text style={styles.logDetail}>Jumlah: {item.jumlahTampil}</Text>
          {item.keterangan ? <Text style={styles.logDetail}>Ket: {item.keterangan}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: '#ffc107' }]} 
            onPress={() => handleBukaModalEdit(item)}
          >
            <Ionicons name="pencil-outline" size={18} color="#333" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.iconButton, { backgroundColor: '#d9534f' }]} 
            onPress={() => handleDeleteItem(item)}
          >
            <Ionicons name="trash-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
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
      {/* Modal Konfirmasi Hapus */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalHapusVisible}
        onRequestClose={() => setModalHapusVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.title, { color: '#d9534f' }]}>Konfirmasi Hapus</Text>
            
            <Text style={{ fontSize: 16, marginBottom: 20, textAlign: 'center', color: '#333' }}>
              Apakah Anda yakin ingin menghapus riwayat "{itemYangDihapus?.nama}"? Tindakan ini tidak dapat dibatalkan.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#ccc', flex: 1, marginRight: 5, padding: 12 }]} 
                onPress={() => setModalHapusVisible(false)}
              >
                <Text style={styles.actionButtonText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionButton, { backgroundColor: '#d9534f', flex: 1, marginLeft: 5, padding: 12 }]} 
                onPress={eksekusiHapus}
              >
                <Text style={[styles.actionButtonText, { color: '#FFF' }]}>Ya, Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// --- 6. LAYAR LAPORAN ---
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

// --- 7. LAYAR MANAJEMEN USER ---
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
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 20 },
  formContainer: { flex: 1, padding: 20, backgroundColor: '#F5F5F5', justifyContent: 'center' },
  logContainer: { flex: 1, padding: 20, backgroundColor: '#F5F5F5' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#333', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center' },
  label: { fontSize: 16, marginBottom: 5, fontWeight: '600', color: '#444' },
  input: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
  button: { backgroundColor: '#0056b3', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  
  // Custom Dropdown & Search Styles
  dropdownSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 15, marginBottom: 15 },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 8, paddingHorizontal: 12, marginBottom: 15, borderWidth: 1, borderColor: '#DDD' },
  searchInput: { flex: 1, height: 45, fontSize: 16, outlineStyle: 'none' } as any,
  searchListItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEE', flexDirection: 'row', alignItems: 'center' },
  searchListCode: { fontWeight: 'bold', color: '#0056b3', marginRight: 8, width: 65 },
  searchListName: { fontSize: 16, color: '#333', flex: 1 },

  logCard: { backgroundColor: '#FFF', padding: 15, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  badge: { color: '#FFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, fontSize: 12, fontWeight: 'bold', overflow: 'hidden' },
  logDate: { color: '#888', fontSize: 12 },
  logItemName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 3 },
  logDetail: { fontSize: 14, color: '#555' },
  reportCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 20 },
  reportCardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  reportText: { fontSize: 16, color: '#555', marginBottom: 8 },
  statCard: { backgroundColor: '#FFF', padding: 20, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#E0E0E0', borderLeftWidth: 6 },
  statLabel: { fontSize: 14, color: '#666', fontWeight: '600', textTransform: 'uppercase', marginBottom: 5 },
  statValue: { fontSize: 28, fontWeight: 'bold', marginBottom: 5 },
  statDesc: { fontSize: 12, color: '#888' },
  actionButtonContainer: { flexDirection: 'row', marginTop: 12 },
  actionButton: { padding: 8, borderRadius: 6, alignItems: 'center' },
  actionButtonText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  iconButton: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 20 },
  modalContent: { backgroundColor: '#FFF', borderRadius: 10, padding: 20, width: '100%', maxWidth: 400, elevation: 5 },
});

