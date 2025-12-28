import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, AlertCircle, User, Phone, Mail, Users, Plus, Trash2, 
  Edit2, Save, X 
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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Child {
  id: string;
  name: string;
  age: number;
  gender: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [editingChildId, setEditingChildId] = useState<string | null>(null);
  
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [children, setChildren] = useState<Child[]>([]);
  
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
    
    fetchChildren();
  }, [navigate]);

  const fetchChildren = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/children`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setChildren(data.children || []);
      }
    } catch (err) {
      console.error('Error fetching children:', err);
    }
  };

  const handleProfileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleUpdateProfile = async () => {
    if (!profileData.name.trim()) {
      setError('Name is required');
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
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      // Update local storage
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setIsEditingProfile(false);

      toast({
        title: 'Profile Updated',
        description: 'Your profile has been updated successfully.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
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
      setError('Child name is required');
      return;
    }
    if (!editChild.age || parseInt(editChild.age) < 1 || parseInt(editChild.age) > 18) {
      setError('Please enter a valid age (1-18)');
      return;
    }
    if (!editChild.gender) {
      setError('Please select gender');
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
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editChild.name,
          age: parseInt(editChild.age),
          gender: editChild.gender,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update child');
      }

      // Update local state
      setChildren(children.map(child => 
        child.id === editingChildId ? data.child : child
      ));
      setEditingChildId(null);
      setEditChild({ name: '', age: '', gender: '' });

      toast({
        title: 'Child Updated',
        description: 'Child information has been updated successfully.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update child';
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
      setError('Child name is required');
      return;
    }
    if (!newChild.age || parseInt(newChild.age) < 1 || parseInt(newChild.age) > 18) {
      setError('Please enter a valid age (1-18)');
      return;
    }
    if (!newChild.gender) {
      setError('Please select gender');
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
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newChild.name,
          age: parseInt(newChild.age),
          gender: newChild.gender,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add child');
      }

      setChildren([...children, data.child]);
      setNewChild({ name: '', age: '', gender: '' });
      setIsAddingChild(false);

      toast({
        title: 'Child Added',
        description: 'Child information has been added successfully.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add child';
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
    if (!confirm('Are you sure you want to remove this child?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/children/${childId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete child');
      }

      setChildren(children.filter(child => child.id !== childId));

      toast({
        title: 'Child Removed',
        description: 'Child information has been removed.',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to remove child',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8 sm:px-6 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            {t.profile.title}
          </h1>
          <p className="text-gray-600">
            {t.profile.subtitle}
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {t.profile.myProfile}
            </TabsTrigger>
            <TabsTrigger value="children" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t.profile.myChildren}
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t.profile.personalInfo}</span>
                  {!isEditingProfile ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingProfile(true)}
                      className="gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      {t.profile.edit}
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingProfile(false);
                        setProfileData({
                          name: user.name,
                          email: user.email,
                          phone: user.phone,
                        });
                      }}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      {t.profile.cancel}
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  {t.profile.updateInfo}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">{t.profile.fullName}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="name"
                      name="name"
                      value={profileData.name}
                      onChange={handleProfileInputChange}
                      className="pl-10"
                      disabled={!isEditingProfile}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t.profile.email}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      name="email"
                      value={profileData.email}
                      className="pl-10 bg-gray-50"
                      disabled
                    />
                  </div>
                  <p className="text-xs text-gray-500">{t.profile.emailNote}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t.profile.phone}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      name="phone"
                      value={profileData.phone}
                      onChange={handleProfileInputChange}
                      className="pl-10"
                      disabled={!isEditingProfile}
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
                        {t.profile.saving}
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        {t.profile.save}
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Children Tab */}
          <TabsContent value="children">
            <Card className="border-0 shadow-xl">
              <CardHeader className="bg-gradient-to-r from-pink-50 via-purple-50 to-blue-50">
                <CardTitle className="flex items-center justify-between">
                  <span>{t.profile.childrenInfo}</span>
                  {!isAddingChild && (
                    <Button
                      size="sm"
                      onClick={() => setIsAddingChild(true)}
                      className="gap-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 hover:from-pink-600 hover:via-purple-600 hover:to-blue-600 text-white shadow-md"
                    >
                      <Plus className="h-4 w-4" />
                      {t.profile.addChild}
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  {t.profile.manageChildren}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Add Child Form */}
                {isAddingChild && (
                  <Card className="bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 border-2 border-dashed border-purple-300 shadow-md">
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="childName">{t.profile.childName}</Label>
                        <Input
                          id="childName"
                          name="name"
                          value={newChild.name}
                          onChange={handleChildInputChange}
                          placeholder={t.profile.childNamePlaceholder}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="childAge">{t.profile.age}</Label>
                        <Input
                          id="childAge"
                          name="age"
                          type="number"
                          min="1"
                          max="18"
                          value={newChild.age}
                          onChange={handleChildInputChange}
                          placeholder={t.profile.agePlaceholder}
                          className="bg-white"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="childGender">{t.profile.gender}</Label>
                        <Select value={newChild.gender} onValueChange={handleSelectChange}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder={t.profile.genderPlaceholder} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="M">{t.profile.male}</SelectItem>
                            <SelectItem value="F">{t.profile.female}</SelectItem>
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
                              {t.profile.adding}
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              {t.profile.addChild}
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

                {/* Children List */}
                <div className="space-y-3">
                  {children.length === 0 && !isAddingChild ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-semibold">{t.profile.noChildren}</p>
                      <p className="text-sm">{t.profile.addFirstChild}</p>
                    </div>
                  ) : (
                    children.map((child, index) => {
                      // Rotate through beautiful gradient colors for each child card
                      const gradients = [
                        'from-pink-100 via-rose-50 to-red-50 border-pink-200',
                        'from-blue-100 via-cyan-50 to-sky-50 border-blue-200',
                        'from-purple-100 via-violet-50 to-indigo-50 border-purple-200',
                        'from-green-100 via-emerald-50 to-teal-50 border-green-200',
                        'from-orange-100 via-amber-50 to-yellow-50 border-orange-200'
                      ];
                      const gradientClass = gradients[index % gradients.length];
                      
                      return (
                      <Card key={child.id} className={`bg-gradient-to-br ${gradientClass} hover:shadow-lg transition-all duration-300 border-2`}>
                        <CardContent className="pt-6">
                          {editingChildId === child.id ? (
                            // Edit Mode
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor={`edit-name-${child.id}`}>{t.profile.childName}</Label>
                                <Input
                                  id={`edit-name-${child.id}`}
                                  name="name"
                                  value={editChild.name}
                                  onChange={handleEditChildInputChange}
                                  placeholder={t.profile.childNamePlaceholder}
                                  className="bg-white/80"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-age-${child.id}`}>{t.profile.age}</Label>
                                  <Input
                                    id={`edit-age-${child.id}`}
                                    name="age"
                                    type="number"
                                    min="1"
                                    max="18"
                                    value={editChild.age}
                                    onChange={handleEditChildInputChange}
                                    placeholder={t.profile.agePlaceholder}
                                    className="bg-white/80"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor={`edit-gender-${child.id}`}>{t.profile.gender}</Label>
                                  <Select value={editChild.gender} onValueChange={handleEditSelectChange}>
                                    <SelectTrigger className="bg-white/80">
                                      <SelectValue placeholder={t.profile.genderPlaceholder} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="M">{t.profile.male}</SelectItem>
                                      <SelectItem value="F">{t.profile.female}</SelectItem>
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
                                      {t.profile.saving}
                                    </>
                                  ) : (
                                    <>
                                      <Save className="mr-2 h-4 w-4" />
                                      {t.profile.save}
                                    </>
                                  )}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={handleCancelEditChild}
                                  disabled={isLoading}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // View Mode
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h3 className="font-bold text-xl text-gray-800">{child.name}</h3>
                                <div className="flex gap-4 text-sm text-gray-700 mt-2">
                                  <span className="font-medium">{t.profile.age}: {child.age}</span>
                                  <span className="font-medium">{t.profile.gender}: {child.gender === 'M' ? t.profile.male : t.profile.female}</span>
                                  <span className="text-xs text-gray-500">{t.profile.childId}: {child.id}</span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEditChild(child)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100/50"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteChild(child.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-100/50"
                                >
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
