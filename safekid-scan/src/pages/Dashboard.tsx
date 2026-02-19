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
      const userData = localStorage.getItem('user');
      const currentUser = userData ? JSON.parse(userData) : null;
      
      if (!currentUser || !currentUser._id) {
        console.error('User ID not found');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/statistics?user_id=${currentUser._id}`, {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/60 to-sky-50">
      <Header />
      
      <main className="w-full px-10 py-14 sm:px-12 md:px-16 lg:px-14 xl:px-16">
        {/* Welcome Section */}
        <div className="mb-12 text-center">
          <div className="overflow-visible">
            <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 bg-clip-text text-transparent mb-4 pb-2" style={{ lineHeight: '1.3' }}>
              Welcome back, {user?.name}!
            </h1>
          </div>
          <p className="text-gray-600 text-xl max-w-2xl mx-auto leading-relaxed">
            Monitor and protect your children's social media safety with our comprehensive platform
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Total Complaints
                </CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900 mb-1">{stats.totalComplaints}</div>
                <p className="text-sm text-gray-500">Submitted reports</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  High Risk Cases
                </CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-700 mb-1">{stats.highRiskComplaints}</div>
                <p className="text-sm text-gray-500">Require attention</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-semibold text-gray-700">
                  Children Registered
                </CardTitle>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-700 mb-1">{stats.children}</div>
                <p className="text-sm text-gray-500">Under monitoring</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 text-white overflow-hidden relative h-full flex flex-col">
              <div className="absolute inset-0 bg-gradient-to-br from-sky-300/20 to-transparent"></div>
              <CardHeader className="relative z-10">
                <div className="p-4 bg-white/20 rounded-2xl w-fit mb-4 backdrop-blur-sm">
                  <Shield className="h-12 w-12 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold mb-2">Submit New Complaint</CardTitle>
                <CardDescription className="text-blue-100 text-base">
                  Report concerns about your child's social media activity with our secure platform
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 mt-auto">
                <Button
                  onClick={() => navigate('/complaint-form')}
                  className="w-full bg-white text-blue-600 hover:bg-blue-50 font-semibold h-12 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Submit Complaint
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-600 text-white overflow-hidden relative h-full flex flex-col">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-300/20 to-transparent"></div>
              <CardHeader className="relative z-10">
                <div className="p-4 bg-white/20 rounded-2xl w-fit mb-4 backdrop-blur-sm">
                  <Users className="h-12 w-12 text-white" />
                </div>
                <CardTitle className="text-2xl font-bold mb-2">Manage Children</CardTitle>
                <CardDescription className="text-blue-100 text-base">
                  Add or edit your children's information and profiles for better monitoring
                </CardDescription>
              </CardHeader>
              <CardContent className="relative z-10 mt-auto">
                <Button
                  onClick={() => navigate('/profile', { state: { activeTab: 'children' } })}
                  className="w-full bg-white text-blue-700 hover:bg-blue-50 font-semibold h-12 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                >
                  Manage Profile
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Educational Resources */}
        <div className="mb-12">
          <h2 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 bg-clip-text text-transparent mb-8">Safety Guides</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50/40 group">
              <CardHeader className="pb-4">
                <div className="p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform duration-200">
                  <Shield className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900 mb-2">Social Media Safety Guide</CardTitle>
                <CardDescription className="text-gray-600 leading-relaxed">
                  Learn how to protect your children from online threats, cyberbullying, and digital dangers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full border-blue-200 text-blue-700 hover:border-blue-300 font-semibold h-12 rounded-xl transition-all duration-200"
                  onClick={() => navigate('/resources/safety-guide')}
                >
                  Read Guide
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50/40 group">
              <CardHeader className="pb-4">
                <div className="p-4 bg-gradient-to-br from-sky-100 to-blue-200 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform duration-200">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900 mb-2">Parent-Teacher Communication</CardTitle>
                <CardDescription className="text-gray-600 leading-relaxed">
                  Best practices for discussing online safety with your child's school and educators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full border-blue-200 text-blue-700 hover:border-blue-300 font-semibold h-12 rounded-xl transition-all duration-200"
                  onClick={() => navigate('/resources/communication')}
                >
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-white to-blue-50/40 group">
              <CardHeader className="pb-4">
                <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform duration-200">
                  <TrendingUp className="h-8 w-8 text-blue-700" />
                </div>
                <CardTitle className="text-xl font-bold text-gray-900 mb-2">Digital Literacy Tips</CardTitle>
                <CardDescription className="text-gray-600 leading-relaxed">
                  Age-appropriate guidelines for different social media platforms and digital citizenship
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full border-blue-200 text-blue-700 hover:border-blue-300 font-semibold h-12 rounded-xl transition-all duration-200"
                  onClick={() => navigate('/resources/digital-literacy')}
                >
                  View Tips
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Activity Section */}
        <Card className="border-0 shadow-2xl bg-gradient-to-r from-blue-500 via-sky-600 to-indigo-600 text-white overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/90 via-sky-700/90 to-indigo-700/90"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
          <CardContent className="p-8 relative z-10">
            <div className="flex items-start gap-6">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-3">
                  Stay Informed
                </h3>
                <p className="text-blue-100 text-lg leading-relaxed mb-4">
                  Check your recent activities and stay updated with the latest safety recommendations for your children.
                </p>
                <Button
                  variant="secondary"
                  className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-6 py-2 rounded-xl shadow-lg"
                  onClick={() => navigate('/complaint-result')}
                >
                  View Recent Activity
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
