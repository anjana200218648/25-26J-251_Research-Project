import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Header } from '@/components/Header';
import { useToast } from '@/hooks/use-toast';

interface ComplaintFormData {
  guardian_name: string;
  child_id: string;
  child_name: string;
  age: string;
  phone_number: string;
  region: string;
  complaint: string;
  child_gender: string;
  hours_per_day_on_social_media: string;
  device_type: string;
  reporter_role: string;
}

interface Child {
  id: string;
  name: string;
  age: number;
  gender: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ComplaintForm = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [user, setUser] = useState<any>(null);
  
  const [formData, setFormData] = useState<ComplaintFormData>({
    guardian_name: '',
    child_id: '',
    child_name: '',
    age: '',
    phone_number: '',
    region: '',
    complaint: '',
    child_gender: '',
    hours_per_day_on_social_media: '',
    device_type: '',
    reporter_role: '',
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
    setFormData(prev => ({
      ...prev,
      guardian_name: parsedUser.name,
      phone_number: parsedUser.phone,
    }));
    
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

  const handleChildSelect = (childId: string) => {
    const selectedChild = children.find(c => c.id === childId);
    if (selectedChild) {
      // Map database gender format (M/F) to form format (Male/Female)
      const genderMap: { [key: string]: string } = {
        'M': 'Male',
        'F': 'Female',
        'Male': 'Male',
        'Female': 'Female'
      };
      
      setFormData(prev => ({
        ...prev,
        child_id: childId,
        child_name: selectedChild.name,
        age: selectedChild.age.toString(),
        child_gender: genderMap[selectedChild.gender] || selectedChild.gender,
      }));
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const validateForm = (): boolean => {
    if (!formData.guardian_name.trim()) {
      setError('Guardian/Parent name is required');
      return false;
    }
    if (!formData.child_name.trim()) {
      setError("Child's name is required");
      return false;
    }
    const age = parseInt(formData.age);
    if (!formData.age || age < 1 || age > 18) {
      setError('Please enter a valid age (1-18)');
      return false;
    }
    if (!formData.phone_number.trim() || formData.phone_number.length < 10) {
      setError('Please enter a valid phone number (minimum 10 digits)');
      return false;
    }
    if (!formData.region.trim()) {
      setError('Region is required');
      return false;
    }
    if (!formData.complaint.trim()) {
      setError('Please enter a complaint');
      return false;
    }
    if (!formData.child_gender) {
      setError('Please select child gender');
      return false;
    }
    const hours = parseFloat(formData.hours_per_day_on_social_media);
    if (!formData.hours_per_day_on_social_media || hours < 0 || hours > 24) {
      setError('Please enter valid hours (0-24)');
      return false;
    }
    if (!formData.device_type) {
      setError('Please select device type');
      return false;
    }
    if (!formData.reporter_role) {
      setError('Please select your role');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/complaints/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          age: parseInt(formData.age),
          hours_per_day_on_social_media: parseFloat(formData.hours_per_day_on_social_media),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to submit complaint');
      }

      const result = await response.json();

      toast({
        title: 'Complaint Submitted Successfully',
        description: `Risk Assessment: ${result.risk_level}`,
      });

      // Navigate to results page with the complaint data
      navigate('/complaint-result', { state: { result } });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit complaint';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <CardTitle className="text-3xl font-bold">Submit Complaint</CardTitle>
            <CardDescription className="text-blue-50">
              Report concerns about your child's social media usage and online safety
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-6">
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Guardian Information */}
                            <div className="space-y-4">
                              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                                Guardian/Parent Information
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="guardian_name">
                                    Guardian/Parent Name <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id="guardian_name"
                                    name="guardian_name"
                                    value={formData.guardian_name}
                                    onChange={handleInputChange}
                                    placeholder="Enter your full name"
                                    required
                                  />
                                </div>
            
                                <div className="space-y-2">
                                  <Label htmlFor="phone_number">
                                    Phone Number <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id="phone_number"
                                    name="phone_number"
                                    value={formData.phone_number}
                                    onChange={handleInputChange}
                                    placeholder="e.g., +1234567890"
                                    type="tel"
                                    required
                                  />
                                </div>
                              </div>
            
                              <div className="space-y-2">
                                <Label htmlFor="region">
                                  Region <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                  id="region"
                                  name="region"
                                  value={formData.region}
                                  onChange={handleInputChange}
                                  placeholder="City, State, or Country"
                                  required
                                />
                              </div>
                            </div>
            
                            {/* Child Information */}
                            <div className="space-y-4">
                              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2 flex items-center justify-between">
                                Child Information
                                {children.length === 0 && (
                                  <Button
                                    type="button"
                                    variant="link"
                                    onClick={() => navigate('/profile')}
                                    className="text-sm text-blue-600"
                                  >
                                    Add a child first
                                  </Button>
                                )}
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="child_select">
                                    Child Name <span className="text-red-500">*</span>
                                  </Label>
                                  {children.length > 0 ? (
                                    <Select value={formData.child_id} onValueChange={handleChildSelect}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select child" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {children.map((child) => (
                                          <SelectItem key={child.id} value={child.id}>
                                            {child.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      id="child_name"
                                      name="child_name"
                                      value={formData.child_name}
                                      onChange={handleInputChange}
                                      placeholder="Enter child's name"
                                      required
                                    />
                                  )}
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="age">
                                    Age <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id="age"
                                    name="age"
                                    type="number"
                                    min="10"
                                    max="18"
                                    value={formData.age}
                                    onChange={handleInputChange}
                                    placeholder="Child's age"
                                    required
                                    readOnly={formData.child_id !== ''}
                                    className={formData.child_id !== '' ? 'bg-gray-100' : ''}
                                  />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="child_gender">
                                    Gender <span className="text-red-500">*</span>
                                  </Label>
                                  <Select
                                    value={formData.child_gender}
                                    onValueChange={(value) => handleSelectChange('child_gender', value)}
                                    required
                                    disabled={formData.child_id !== ''}
                                  >
                                    <SelectTrigger className={formData.child_id !== '' ? 'bg-gray-100' : ''}>
                                      <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Male">Male</SelectItem>
                                      <SelectItem value="Female">Female</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="hours_per_day_on_social_media">
                                    Daily Social Media Hours <span className="text-red-500">*</span>
                                  </Label>
                                  <Input
                                    id="hours_per_day_on_social_media"
                                    name="hours_per_day_on_social_media"
                                    type="number"
                                    min="0"
                                    max="24"
                                    step="0.5"
                                    value={formData.hours_per_day_on_social_media}
                                    onChange={handleInputChange}
                                    placeholder="e.g., 3.5"
                                    required
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="device_type">
                                    Primary Device Used <span className="text-red-500">*</span>
                                  </Label>
                                  <Select
                                    value={formData.device_type}
                                    onValueChange={(value) => handleSelectChange('device_type', value)}
                                    required
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select device" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="smartphone">Smartphone</SelectItem>
                                      <SelectItem value="tablet">Tablet</SelectItem>
                                      <SelectItem value="laptop">Laptop</SelectItem>
                                      <SelectItem value="desktop">Desktop</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="reporter_role">
                                    Your Role <span className="text-red-500">*</span>
                                  </Label>
                                  <Select
                                    value={formData.reporter_role}
                                    onValueChange={(value) => handleSelectChange('reporter_role', value)}
                                    required
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="parent">Parent</SelectItem>
                                      <SelectItem value="guardian">Guardian</SelectItem>
                                      <SelectItem value="teacher">Teacher</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
            
                            {/* Complaint */}
                            <div className="space-y-4">
                              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                                Complaint Details
                              </h3>
                              
                              <div className="space-y-2">
                                <Label htmlFor="complaint">
                                  Complaint Description <span className="text-red-500">*</span>
                                </Label>
                                
                                <Textarea
                                  id="complaint"
                                  name="complaint"
                                  value={formData.complaint}
                                  onChange={handleInputChange}
                                  placeholder="Please describe your concerns about your child's social media usage, behavior, or any incidents..."
                                  className="min-h-[150px] resize-y"
                                  required
                                />
                              </div>
                            </div>
            
                            {/* Submit Button */}
                            <div className="flex gap-4 pt-4">
                              <Button
                                type="submit"
                                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Analyzing...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Submit Complaint
                                  </>
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate('/dashboard')}
                                disabled={isSubmitting}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                      </CardContent>
                    </Card>
            
                    <div className="mt-6 text-center text-sm text-gray-600">
                      <p>
                        Your information will be kept confidential and used only for risk assessment purposes.
                      </p>
                    </div>
                  </div>
                </div>
  );
};

export default ComplaintForm;
