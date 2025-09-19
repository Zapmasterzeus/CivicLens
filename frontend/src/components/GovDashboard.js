import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './GovDashboard.css';

const customMarker = new L.Icon({
  iconUrl: '/map-marker.png',
  iconSize: [80, 80],
  iconAnchor: [40, 80],
  popupAnchor: [0, -80],
  shadowUrl: null,
  shadowSize: null,
  shadowAnchor: null
});

const GovDashboard = ({ govId }) => {
  const [complaints, setComplaints] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [completedLoading, setCompletedLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [mapCenter, setMapCenter] = useState([12.9412, 77.5661]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'completed'

  // Helper component to center map when mapCenter changes
  function MapCenterer({ center }) {
    const map = useMap();
    useEffect(() => {
      map.setView(center, 17, { animate: true });
    }, [center, map]);
    return null;
  }

  useEffect(() => {
    fetchComplaints();
    fetchCompletedTasks();
  }, []);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:5000/api/complaints');
      setComplaints(res.data);
      setError('');
    } catch (err) {
      setError('Failed to load complaints');
    }
    setLoading(false);
  };

  const fetchCompletedTasks = async () => {
    setCompletedLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/completed?by=${govId}`);
      setCompletedTasks(res.data);
    } catch (err) {
      console.error('Failed to load completed tasks:', err);
    }
    setCompletedLoading(false);
  };

  // Helper: count in-progress for this gov
  const inProgressCount = complaints.filter(c => c.status === 'in progress' && c.assignedTo === govId).length;

  const handleStatusChange = async (id, newStatus) => {
    setUpdating(true);
    try {
      const patchBody = { status: newStatus };
      if (govId && (newStatus === 'in progress' || newStatus === 'success')) patchBody.govId = govId;
      await axios.patch(`http://localhost:5000/api/complaints/${id}`, patchBody);
      if (newStatus === 'success') {
        // Move to completed collection
        const comp = complaints.find(c => c._id === id);
      await axios.post('http://localhost:5000/api/completed', {
        description: comp.description,
        category: comp.category,
        location: comp.location,
        status: 'success',
        by: govId
      });
      await axios.delete(`http://localhost:5000/api/complaints/${id}`);
      // Remove from local state for instant UI update
      setComplaints(complaints.filter(c => c._id !== id));
      // Refresh completed tasks to show the newly completed one
      fetchCompletedTasks();
      setError(''); // Clear error on success
      setUpdating(false);
      return; // Prevent fetchComplaints
    }
    fetchComplaints();
    setError(''); // Clear error on success
    } catch (err) {
      setError('Failed to update status');
      console.error('Status update error:', err);
    }
    setUpdating(false);
  };

  return (
    <div className="gov-dashboard">
      <h2>Government Dashboard</h2>
      
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Tasks ({complaints.length})
        </button>
        <button 
          className={`tab-button ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          My Completed Tasks ({completedTasks.length})
        </button>
      </div>

      {loading && activeTab === 'pending' ? <p>Loading...</p> : error ? <p className="error">{error}</p> : null}
      {completedLoading && activeTab === 'completed' ? <p>Loading completed tasks...</p> : null}

      <div className="dashboard-content">
        {activeTab === 'pending' && (
          <>
            <div className="complaints-list">
              {complaints.map(complaint => {
                const isPending = complaint.status === 'pending' || complaint.status === 'Pending';
                const isExpanded = selectedId === complaint._id;
                return (
                  <div key={complaint._id} className="complaint-item" style={{ cursor: isPending ? 'pointer' : 'default' }}>
                    <div
                      onClick={() => {
                        if (isPending) {
                          setSelectedId(isExpanded ? null : complaint._id);
                          if (!isExpanded) {
                            setMapCenter([complaint.location.coordinates[1], complaint.location.coordinates[0]]);
                          }
                        }
                      }}
                      style={{ fontWeight: isExpanded ? 'bold' : 'normal' }}
                    >
                      <b>{complaint.category}</b> - {complaint.description}
                      <br/>
                      <span>Status: {complaint.status}</span>
                      {isPending && <span style={{ color: '#1976d2', marginLeft: 8 }}>[Click to expand]</span>}
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: 6, fontSize: 14, color: '#333' }}>
                        <div>Latitude: {complaint.location.coordinates[1]}</div>
                        <div>Longitude: {complaint.location.coordinates[0]}</div>
                      </div>
                    )}
                    <button disabled={updating} onClick={() => handleStatusChange(complaint._id, 'pending')}>Pending</button>
                    <button
                      disabled={
                        updating ||
                        // If assigned to someone else, disable
                        (complaint.assignedTo && complaint.assignedTo !== govId) ||
                        // If max 3 in progress and this is not already assigned to this gov
                        (!complaint.assignedTo && inProgressCount >= 3)
                      }
                      title={
                        (complaint.assignedTo && complaint.assignedTo !== govId)
                          ? 'Assigned to another employee'
                          : (!complaint.assignedTo && inProgressCount >= 3)
                            ? 'You already have 3 in progress'
                            : ''
                      }
                      onClick={() => handleStatusChange(complaint._id, 'in progress')}
                    >In Progress</button>
                    <button
                      disabled={
                        updating ||
                        complaint.status !== 'in progress' ||
                        (complaint.assignedTo && complaint.assignedTo !== govId)
                      }
                      title={
                        (complaint.assignedTo && complaint.assignedTo !== govId)
                          ? 'Assigned to another employee'
                          : (complaint.status !== 'in progress')
                            ? 'Set to In Progress first'
                            : ''
                      }
                      onClick={() => handleStatusChange(complaint._id, 'success')}
                    >Success</button>
                  </div>
                );
              })}
            </div>
            <div className="dashboard-map">
              <h3>Pending Tasks Map</h3>
              <MapContainer center={mapCenter} zoom={17} maxZoom={23} style={{ height: '500px', width: '100%' }}>
                <MapCenterer center={mapCenter} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  maxZoom={23}
                />
                {complaints.map(complaint => (
                  <Marker
                    key={complaint._id}
                    position={[complaint.location.coordinates[1], complaint.location.coordinates[0]]}
                    icon={customMarker}
                  >
                    <Popup>
                      <b>{complaint.category}</b><br />
                      {complaint.description}<br />
                      Status: {complaint.status}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </>
        )}

        {activeTab === 'completed' && (
          <>
            <div className="complaints-list">
              {completedTasks.map(task => (
                <div key={task._id} className="complaint-item completed-item">
                  <div>
                    <b>{task.category}</b> - {task.description}
                    <br/>
                    <span>Status: {task.status}</span>
                    <br/>
                    <span style={{ color: '#4caf50', fontSize: '12px' }}>
                      Completed by: {task.by}
                    </span>
                  </div>
                </div>
              ))}
              {completedTasks.length === 0 && !completedLoading && (
                <p>No completed tasks yet.</p>
              )}
            </div>
            <div className="dashboard-map">
              <h3>My Completed Tasks Map</h3>
              <MapContainer center={mapCenter} zoom={17} maxZoom={23} style={{ height: '500px', width: '100%' }}>
                <MapCenterer center={mapCenter} />
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  maxZoom={23}
                />
                {completedTasks.map(task => (
                  <Marker
                    key={task._id}
                    position={[task.location.coordinates[1], task.location.coordinates[0]]}
                    icon={customMarker}
                  >
                    <Popup>
                      <b>{task.category}</b><br />
                      {task.description}<br />
                      Status: {task.status}<br />
                      Completed by: {task.by}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GovDashboard;
