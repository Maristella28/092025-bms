import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  Card,
  CardContent,
  Pagination,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  DeleteSweep as CleanupIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    model_type: '',
    search: '',
    date_from: '',
    date_to: '',
    page: 1,
    per_page: 20,
  });
  const [filterOptions, setFilterOptions] = useState({
    actions: [],
    model_types: [],
    users: [],
  });
  const [statistics, setStatistics] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
    fetchFilterOptions();
    fetchStatistics();
  }, [filters.page, filters.per_page]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== '') {
          params.append(key, value);
        }
      });

      const response = await axios.get(`/api/admin/activity-logs?${params}`);
      setLogs(response.data.logs.data);
      setTotalPages(response.data.logs.last_page);
      setError(null);
    } catch (err) {
      setError('Failed to fetch activity logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await axios.get('/api/admin/activity-logs/filters/options');
      setFilterOptions(response.data.filters);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  const fetchStatistics = async () => {
    try {
      const response = await axios.get('/api/admin/activity-logs/statistics/summary');
      setStatistics(response.data.statistics);
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
      page: 1, // Reset to first page when filtering
    }));
  };

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
    fetchLogs();
  };

  const handleExport = async () => {
    try {
      const response = await axios.post('/api/admin/activity-logs/export', filters);
      // Create and download CSV
      const csvContent = generateCSV(response.data.logs.data);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting logs:', err);
    }
  };

  const handleCleanup = async () => {
    if (window.confirm('Are you sure you want to delete activity logs older than 90 days?')) {
      try {
        await axios.delete('/api/admin/activity-logs/cleanup');
        fetchLogs();
        fetchStatistics();
      } catch (err) {
        console.error('Error cleaning up logs:', err);
      }
    }
  };

  const generateCSV = (data) => {
    const headers = ['Date', 'User', 'Action', 'Model', 'Description', 'IP Address'];
    const rows = data.map(log => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.user?.name || 'System',
      log.action,
      log.model_type ? `${log.model_type}#${log.model_id}` : 'N/A',
      log.description,
      log.ip_address || 'N/A',
    ]);

    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  };

  const getActionColor = (action) => {
    if (action.includes('login')) return 'success';
    if (action.includes('logout')) return 'warning';
    if (action.includes('delete')) return 'error';
    if (action.includes('create')) return 'info';
    if (action.includes('update')) return 'primary';
    return 'default';
  };

  const formatDate = (dateString) => {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm:ss');
  };

  if (loading && logs.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Activity Logs
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Logs
                </Typography>
                <Typography variant="h5">
                  {statistics.total_logs.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Login Events
                </Typography>
                <Typography variant="h5">
                  {statistics.login_count.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  User Registrations
                </Typography>
                <Typography variant="h5">
                  {statistics.user_registrations.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Profile Updates
                </Typography>
                <Typography variant="h5">
                  {statistics.resident_updates.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Search"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={handleSearch}>
                    <SearchIcon />
                  </IconButton>
                ),
              }}
            />
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Action</InputLabel>
              <Select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                label="Action"
              >
                <MenuItem value="">All Actions</MenuItem>
                {filterOptions.actions.map((action) => (
                  <MenuItem key={action} value={action}>
                    {action}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Model Type</InputLabel>
              <Select
                value={filters.model_type}
                onChange={(e) => handleFilterChange('model_type', e.target.value)}
                label="Model Type"
              >
                <MenuItem value="">All Models</MenuItem>
                {filterOptions.model_types.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={fetchLogs}
            >
              Refresh
            </Button>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Date From"
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Date To"
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
            >
              Export CSV
            </Button>
          </Grid>
          <Grid xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<CleanupIcon />}
              onClick={handleCleanup}
            >
              Cleanup Old Logs
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Activity Logs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>{formatDate(log.created_at)}</TableCell>
                <TableCell>{log.user?.name || 'System'}</TableCell>
                <TableCell>
                  <Chip
                    label={log.action}
                    color={getActionColor(log.action)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {log.model_type ? `${log.model_type.split('\\').pop()}#${log.model_id}` : 'N/A'}
                </TableCell>
                <TableCell sx={{ maxWidth: 300 }}>
                  <Typography noWrap title={log.description}>
                    {log.description}
                  </Typography>
                </TableCell>
                <TableCell>{log.ip_address || 'N/A'}</TableCell>
                <TableCell>
                  <Tooltip title="View Details">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setSelectedLog(log);
                        setShowDetails(true);
                      }}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Box display="flex" justifyContent="center" mt={2}>
        <Pagination
          count={totalPages}
          page={filters.page}
          onChange={(e, page) => handleFilterChange('page', page)}
          color="primary"
        />
      </Box>

      {/* Details Dialog */}
      <Dialog open={showDetails} onClose={() => setShowDetails(false)} maxWidth="md" fullWidth>
        <DialogTitle>Activity Log Details</DialogTitle>
        <DialogContent>
          {selectedLog && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedLog.description}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography><strong>User:</strong> {selectedLog.user?.name || 'System'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography><strong>Action:</strong> {selectedLog.action}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography><strong>Date:</strong> {formatDate(selectedLog.created_at)}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography><strong>IP Address:</strong> {selectedLog.ip_address || 'N/A'}</Typography>
                </Grid>
                {selectedLog.model_type && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <Typography><strong>Model:</strong> {selectedLog.model_type}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <Typography><strong>Model ID:</strong> {selectedLog.model_id}</Typography>
                    </Grid>
                  </>
                )}
                {selectedLog.old_values && (
                  <Grid item xs={12}>
                    <Typography variant="h6">Previous Values:</Typography>
                    <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </Grid>
                )}
                {selectedLog.new_values && (
                  <Grid item xs={12}>
                    <Typography variant="h6">New Values:</Typography>
                    <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ActivityLogs;
