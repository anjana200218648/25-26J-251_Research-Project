import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, FileText, TrendingUp, ArrowRight, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/Header';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    totalComplaints: 0,
    highRiskComplaints: 0,
    children: 0,
  });

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (!userData || !token) {
      navigate('/login');
      return;
    }
    
    setUser(JSON.parse(userData));
    
    // Fetch user statistics
    fetchStats();
  }, [navigate]);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/statistics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          totalComplaints: data.totalComplaints || 0,
          highRiskComplaints: data.highRiskComplaints || 0,
          children: data.children || 0,
        });
      } else {
        console.error('Failed to fetch statistics');
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Keep default values on error
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <Header />
      
      <main className="container mx-auto px-4 py-8 sm:px-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600 text-lg">
            Monitor and protect your children's social media safety
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Complaints
              </CardTitle>
              <FileText className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.totalComplaints}</div>
              <p className="text-xs text-gray-500 mt-1">Submitted reports</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                High Risk Cases
              </CardTitle>
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{stats.highRiskComplaints}</div>
              <p className="text-xs text-gray-500 mt-1">Require attention</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Children Registered
              </CardTitle>
              <Users className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{stats.children}</div>
              <p className="text-xs text-gray-500 mt-1">Under monitoring</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardHeader>
              <Shield className="h-12 w-12 mb-4 opacity-90" />
              <CardTitle className="text-2xl font-bold">Submit New Complaint</CardTitle>
              <CardDescription className="text-blue-100">
                Report concerns about your child's social media activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate('/complaint-form')}
                className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold h-12"
              >
                Submit Complaint
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-600 text-white">
            <CardHeader>
              <Users className="h-12 w-12 mb-4 opacity-90" />
              <CardTitle className="text-2xl font-bold">Manage Children</CardTitle>
              <CardDescription className="text-pink-100">
                Add or edit your children's information and profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate('/profile')}
                className="w-full bg-white text-purple-600 hover:bg-purple-50 font-semibold h-12"
              >
                Manage Profile
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Information Banner */}
        <Card className="mt-8 border-0 shadow-lg bg-gradient-to-r from-indigo-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  AI-Powered Risk Assessment
                </h3>
                <p className="text-gray-600">
                  Our advanced machine learning system analyzes complaints to identify potential risks 
                  and provides accurate assessments to help you take appropriate action for your child's safety.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
