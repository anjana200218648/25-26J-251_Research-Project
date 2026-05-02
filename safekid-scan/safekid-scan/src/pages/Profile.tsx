import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, AlertCircle, User, Phone, Mail, Users, Plus, Trash2, 
  Edit2, Save, X, ArrowLeft
} from 'lucide-react';
import { Header } from '@/components/Header';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// API Base URLs - 8001 port එකට connect වෙන්න
const API_BASE_URL = 'http://localhost:8001';
const AUTH_API_URL = 'http://localhost:8001';

interface Child {
  id: string;
  name: string;
  age: number;
  gender: string;
}
interface ProfileData {
  name: string;
  email: string;
  phone: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  // alias profile translations as `tp` and widen the type to `any` to avoid
  // TS errors when accessing optional translation keys used in this file.
  const tp = (t?.profile ?? {}) as any;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>(
    (location.state as any)?.activeTab || 'profile'
  );

  const [profileData, setProfileData] = useState<ProfileData>({
    name: '',
    email: '',
    phone: '',
  });

  const [children, setChildren] = useState<Child[]>([]);

  // Normalize backend child object to our `Child` shape (handles `_id` vs `id`)
  const normalizeChildItem = (item: any): Child => ({
    id: item.id || item._id || String(item._id) || '',
    name: item.name || item.fullName || '',
    age: typeof item.age === 'number' ? item.age : parseInt(item.age) || 0,
    gender: item.gender || item.sex || '',
  });

  const [newChild, setNewChild] = useState({
    name: '',
    age: '',
    gender: '',
  });

  const [editChild, setEditChild] = useState({
    name: '',
    age: '',
    gender: '',
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (!userData || !token) {
      navigate('/login');
      return;
    }

    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);
    setProfileData({
      name: parsedUser.name || '',
      email: parsedUser.email || '',
      phone: parsedUser.phone || '',
    });

    if ((location.state as any)?.activeTab) {
      setActiveTab((location.state as any).activeTab);
    }

    fetchChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const fetchChildren = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/children`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data) ? data : data.children || [];
        setChildren(list.map((i: any) => normalizeChildItem(i)));
      }
    } catch (err) {
      console.error('Error fetching children:', err);
    }
  };

  const handleProfileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name as keyof ProfileData]: value }));
    setError(null);
  };

  const handleUpdateProfile = async () => {
    if (!profileData.name.trim()) {
      setError(tp.nameRequired || 'Name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || tp.profileUpdateFailed);
      }

      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setIsEditingProfile(false);

      toast({
        title: tp.profileUpdated,
        description: tp.profileUpdatedDesc,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : tp.profileUpdateFailed;
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChildInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewChild((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSelectChange = (value: string) => {
    setNewChild((prev) => ({ ...prev, gender: value }));
    setError(null);
  };

  const handleEditSelectChange = (value: string) => {
    setEditChild((prev) => ({ ...prev, gender: value }));
    setError(null);
  };

  const handleEditChildInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditChild((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleStartEditChild = (child: Child) => {
    setEditingChildId(child.id);
    setEditChild({
      name: child.name,
      age: child.age.toString(),
      gender: child.gender,
    });
    setError(null);
  };

  const handleCancelEditChild = () => {
    setEditingChildId(null);
    setEditChild({ name: '', age: '', gender: '' });
    setError(null);
  };

  const handleUpdateChild = async () => {
    if (!editChild.name.trim()) {
      setError(tp.childNameRequired);
      return;
    }
    if (!editChild.age || parseInt(editChild.age) < 1 || parseInt(editChild.age) > 18) {
      setError(tp.invalidAge);
      return;
    }
    if (!editChild.gender) {
      setError(tp.genderRequired);
      return;
    }

    if (!editingChildId) {
      setError('No child selected for update');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/children/${editingChildId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editChild.name,
          age: parseInt(editChild.age),
          gender: editChild.gender,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || tp.childUpdateFailed || 'Failed to update child');
      }

      const updated = normalizeChildItem(data.child || data);
      setChildren(children.map((child) => (child.id === editingChildId ? updated : child)));
      setEditingChildId(null);
      setEditChild({ name: '', age: '', gender: '' });

      toast({
        title: tp.childUpdated || 'Child Updated',
        description: tp.childUpdatedDesc || 'Child information has been updated successfully.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : (tp.childUpdateFailed || 'Failed to update child');
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddChild = async () => {
    if (!newChild.name.trim()) {
      setError(tp.childNameRequired || 'Child name is required');
      return;
    }
    if (!newChild.age || parseInt(newChild.age) < 1 || parseInt(newChild.age) > 18) {
      setError(tp.invalidAge || 'Please enter a valid age (1-18)');
      return;
    }
    if (!newChild.gender) {
      setError(tp.genderRequired || 'Please select gender');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/children`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newChild.name,
          age: parseInt(newChild.age),
          gender: newChild.gender,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || tp.childAddFailed);
      }

      const childObj = normalizeChildItem(data.child || data);
      setChildren([...children, childObj]);
      setNewChild({ name: '', age: '', gender: '' });
      setIsAddingChild(false);

      toast({
        title: tp.childAdded,
        description: tp.childAddedDesc,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : tp.childAddFailed;
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!window.confirm(tp.confirmDelete)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/children/${childId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(tp.childDeleteFailed);
      }

      setChildren(children.filter((child) => child.id !== childId));

      toast({
        title: tp.childDeleted,
        description: tp.childDeletedDesc,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: tp.childDeleteFailed,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Header />

      <main className="container mx-auto px-4 py-8 sm:px-6 max-w-4xl">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="mb-6 gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {tp.backToDashboard}
          </Button>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            {tp.title}
          </h1>
          <p className="text-gray-600">{tp.subtitle}</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {tp.myProfile}
            </TabsTrigger>
            <TabsTrigger value="children" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {tp.myChildren}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{tp.personalInfo}</span>
                  {!isEditingProfile ? (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditingProfile(true)} className="gap-2">
                      <Edit2 className="h-4 w-4" />
                      {tp.edit}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileData({
                          name: user?.name || '',
                          email: user?.email || '',
                          phone: user?.phone || '',
                        });
                      }}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      {tp.cancel}
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>{tp.updateProfileDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">{tp.nameLabel}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      name="name"
                      value={profileData.name}
                      onChange={handleProfileInputChange}
                      className="pl-10"
                      disabled={!isEditingProfile}
                      placeholder={tp.namePlaceholder}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{tp.emailLabel}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input id="email" name="email" value={profileData.email} className="pl-10 bg-gray-50" disabled placeholder="you@example.com" />
                  </div>
                  <p className="text-xs text-gray-500">{tp.emailNote}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{tp.phoneLabel}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleProfileInputChange}
                      className="pl-10"
                      disabled={!isEditingProfile}
                      placeholder={tp.phonePlaceholder}
                    />
                  </div>
                </div>

                {isEditingProfile && (
                  <Button
                    onClick={handleUpdateProfile}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    disabled={isLoading}
                  >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {tp.updating}
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            {tp.updateProfile}
                          </>
                        )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="children">
            <Card className="border-0 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50">
                <CardTitle className="flex items-center justify-between">
                  <span>{tp.myChildren}</span>
                  {!isAddingChild && (
                    <Button
                      size="sm"
                      onClick={() => setIsAddingChild(true)}
                      className="gap-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 text-white shadow-md"
                    >
                      <Plus className="h-4 w-4" />
                      {tp.addChild}
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>{tp.manageChildrenDesc}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {isAddingChild && (
                  <Card className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 border-2 border-dashed border-purple-300 shadow-md">
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="childName">{tp.childNameLabel}</Label>
                        <Input
                          id="childName"
                          name="name"
                          value={newChild.name}
                          onChange={handleChildInputChange}
                          placeholder={tp.childNamePlaceholder}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="childAge">{tp.ageLabel}</Label>
                        <Input
                          id="childAge"
                          name="age"
                          type="number"
                          min="1"
                          max="18"
                          value={newChild.age}
                          onChange={handleChildInputChange}
                          placeholder={tp.agePlaceholder}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="childGender">{tp.genderLabel}</Label>
                        <Select value={newChild.gender} onValueChange={handleSelectChange}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder={tp.genderPlaceholder} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">{tp.male}</SelectItem>
                            <SelectItem value="F">{tp.female}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleAddChild}
                          className="flex-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 text-white shadow-md"
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {tp.adding}
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              {tp.addChild}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsAddingChild(false);
                            setNewChild({ name: '', age: '', gender: '' });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3">
                  {children.length === 0 && !isAddingChild ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-semibold">{tp.noChildren}</p>
                      <p className="text-sm">{tp.addFirstChild}</p>
                    </div>
                  ) : (
                    children.map((child, index) => {
                      const gradients = [
                        'from-pink-100 via-rose-50 to-red-50 border-pink-200',
                        'from-blue-100 via-cyan-50 to-sky-50 border-blue-200',
                        'from-purple-100 via-violet-50 to-indigo-50 border-purple-200',
                        'from-green-100 via-emerald-50 to-teal-50 border-green-200',
                        'from-orange-100 via-amber-50 to-yellow-50 border-orange-200',
                      ];
                      const gradientClass = gradients[index % gradients.length];

                      return (
                        <Card key={child.id} className={`bg-gradient-to-br ${gradientClass} hover:shadow-lg transition-all duration-300 border-2`}>
                          <CardContent className="pt-6">
                            {editingChildId === child.id ? (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-name-${child.id}`}>{tp.childNameLabel}</Label>
                                  <Input
                                    id={`edit-name-${child.id}`}
                                    name="name"
                                    value={editChild.name}
                                    onChange={handleEditChildInputChange}
                                    placeholder={tp.childNamePlaceholder}
                                    className="bg-white/80"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label htmlFor={`edit-age-${child.id}`}>{tp.ageLabel}</Label>
                                    <Input
                                      id={`edit-age-${child.id}`}
                                      name="age"
                                      type="number"
                                      min="1"
                                      max="18"
                                      value={editChild.age}
                                      onChange={handleEditChildInputChange}
                                      placeholder={tp.agePlaceholder}
                                      className="bg-white/80"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`edit-gender-${child.id}`}>{tp.genderLabel}</Label>
                                    <Select value={editChild.gender} onValueChange={handleEditSelectChange}>
                                      <SelectTrigger className="bg-white/80">
                                        <SelectValue placeholder={tp.genderPlaceholder} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="M">{tp.male}</SelectItem>
                                        <SelectItem value="F">{tp.female}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <Button
                                    onClick={handleUpdateChild}
                                    className="flex-1 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 text-white shadow-md"
                                    disabled={isLoading}
                                  >
                                    {isLoading ? (
                                      <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {tp.saving}
                                      </>
                                    ) : (
                                      <>
                                        <Save className="mr-2 h-4 w-4" />
                                        {tp.save}
                                      </>
                                    )}
                                  </Button>
                                  <Button variant="outline" onClick={handleCancelEditChild} disabled={isLoading}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h3 className="font-bold text-xl text-gray-800">{child.name}</h3>
                                  <div className="flex gap-4 text-sm text-gray-700 mt-2">
                                    <span className="font-medium">{tp.ageLabel}: {child.age}</span>
                                    <span className="font-medium">{tp.genderLabel}: {child.gender === 'M' || child.gender === 'Male' ? tp.male : tp.female}</span>
                                    <span className="text-xs text-gray-500">ID: {child.id}</span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => handleStartEditChild(child)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-100/50">
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDeleteChild(child.id)} className="text-red-600 hover:text-red-700 hover:bg-red-100/50">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Profile;