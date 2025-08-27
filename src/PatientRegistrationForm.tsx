import React, { useState, useEffect } from 'react';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import Swal from 'sweetalert2';
import logo from './images/openmrslogo.png';

// Age calculation function
const calculateAge = (birthDate: string) => {
  const today = new Date();
  const birthDateObj = new Date(birthDate);

  let years = today.getFullYear() - birthDateObj.getFullYear();
  let months = today.getMonth() - birthDateObj.getMonth();
  let days = today.getDate() - birthDateObj.getDate();

  if (months < 0 || (months === 0 && days < 0)) {
    years--;
    months += 12;
    if (days < 0) {
      const prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      days += prevMonthLastDay;
      months--;
    }
  }

  return { years, months, days };
};

const showToast = ({ title, kind, description }: { title: string; kind: string; description: string }) => {
  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    },
  });

  Toast.fire({
    icon: kind === 'error' ? 'error' : kind === 'success' ? 'success' : 'info',
    title: `${title}: ${description}`,
  });
};

const PatientRegistrationForm = () => {
  const session = useSession();
  const [formData, setFormData] = useState({
    existingPHN: '',
    unknownPatient: false,
    babyOf: false,
    title: '',
    givenName: '',
    familyName: '',
    nicNo: '',
    dateOfBirth: '',
    ageYears: '',
    ageMonths: '',
    ageDays: '',
    gender: 'Male',
    telephoneResidence: '',
    telephoneMobile: '',
    guardianName: '',
    guardianRelationship: '',
    guardianContactNo: '',
    profileImage: null as { file: File; preview: string } | null,
  });

  const [personAttributeTypes, setPersonAttributeTypes] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [userLocation, setUserLocation] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get the user's session location
        if (session?.sessionLocation?.uuid) {
          setUserLocation(session.sessionLocation.uuid);
        }

        const attributeTypesResponse = await openmrsFetch(
          '/ws/rest/v1/personattributetype?v=custom:(uuid,display,format)&limit=100',
        );
        setPersonAttributeTypes(attributeTypesResponse.data.results || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError(error as Error);
        showToast({
          title: 'Error',
          kind: 'error',
          description: 'Failed to load form data. Please try again.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [session]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => {
      const newData = {
        ...prev,
        [name]: type === 'checkbox' ? checked : value,
      };

      if (name === 'dateOfBirth' && value) {
        const age = calculateAge(value);
        newData.ageYears = age.years.toString();
        newData.ageMonths = age.months.toString();
        newData.ageDays = age.days.toString();
      }

      return newData;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast({
          title: 'Error',
          kind: 'error',
          description: 'Image size should be less than 2MB',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData((prev) => ({
          ...prev,
          profileImage: {
            file: file,
            preview: event.target?.result as string,
          },
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const buildAttributes = () => {
    const attributes: Array<{ attributeType: string; value: string }> = [];

    if (formData.telephoneResidence) {
      const phoneAttributeType = personAttributeTypes.find(
        (attr: any) => attr.display.toLowerCase().includes('phone') || attr.display.toLowerCase().includes('telephone'),
      );
      if (phoneAttributeType) {
        attributes.push({
          attributeType: phoneAttributeType.uuid,
          value: formData.telephoneResidence,
        });
      }
    }

    if (formData.telephoneMobile) {
      const mobileAttributeType = personAttributeTypes.find((attr: any) =>
        attr.display.toLowerCase().includes('mobile'),
      );
      if (mobileAttributeType) {
        attributes.push({
          attributeType: mobileAttributeType.uuid,
          value: formData.telephoneMobile,
        });
      }
    }

    if (formData.nicNo) {
      const nicAttributeType = personAttributeTypes.find(
        (attr: any) => attr.display.toLowerCase().includes('nic') || attr.display.toLowerCase().includes('identity'),
      );
      if (nicAttributeType) {
        attributes.push({
          attributeType: nicAttributeType.uuid,
          value: formData.nicNo,
        });
      }
    }

    // Return only if we have attributes, otherwise return undefined
    return attributes.length > 0 ? attributes : undefined;
  };

  const getGeneratedPHN = (): string => {
    let phn = '';
    for (let i = 0; i < 10; i++) {
      phn += Math.floor(Math.random() * 10);
    }
    return phn;
  };

  const printPHNCard = (phn: string, patientName: string, profileImage: string | null) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Failed to open print window');
      return;
    }

    const photoContent = profileImage
      ? `<img src="${profileImage}" alt="Patient Photo" style="width: 100%; height: 100%; object-fit: cover; border-radius: 6px;">`
      : 'PHOTO';

    const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>PHN Card</title>
        <style>
          @page {
  size: 68mm 43mm;
  margin: 0;
}
        body {
              margin: 0;
              padding: 0;
                width: 68mm;
             height: 43mm;
              font-family: Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .card {
              width: 100%;
              height: 100%;
              background: linear-gradient(135deg, #8cbad9ff);
              color: white;
              position: relative;
              overflow: hidden;
              box-sizing: border-box;
              padding: 8px;
              border-radius: 12px;
            }
          .card-header {
              font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            color: #143861;
            margin-bottom: 6px;
          }
          .content {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
          }
          .left-section {
            flex: 1;
            display: flex;
            align-items: flex-start;
              margin-top: 4mm;
          }
           .header-container {
              display: flex;
              align-items: center;
              margin-bottom: 3px;
            }
.logo {
  width: 10mm;   /* reduced from 12mm */
  height: 10mm;  /* reduced from 12mm */
  margin-right: 6px;
  margin-top: 0.2mm; /* keeps it slightly up */
  border-radius: 50%; /* keeps it circular */
  object-fit: cover;
}


            .card-header {
              font-size: 14px;
              font-weight: bold;
              text-transform: uppercase;
              color: rgba(21, 16, 55, 0.9);
            }
            .card-title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 5px;
              text-transform: uppercase;
              color: rgba(21, 16, 55, 0.9);
            }
            .patient-info {
              display: flex;
              align-items: flex-start;
              margin-bottom: 8px;
              color: black;
              margin-top: 8px;
            }
            .logo-patient {
              width: 15mm;
              height: auto;
              margin-right: 8px;
              margin-top: 5px;
            }
            .patient-details {
              flex: 1;
              margin-top: 5px;
            }
           .patient-name {
   font-size: 10px;
  font-weight: bold;
  margin-bottom: 4px;
  text-transform: uppercase;
  line-height: 1.2;
    color: rgba(21, 16, 55, 0.9);
}

         .id-number {
  font-size: 9px;
  margin-bottom: 5px;
  line-height: 1.2;
    color: rgba(21, 16, 55, 0.9);
}
      .right-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-left: 10px;
  margin-top: 1mm; /* move the whole section up */
}

.photo-placeholder {
  width: 12mm;
  height: 12mm;
  border: 1px solid #143861;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: #143861;
  border-radius: 6px;
  margin-bottom: 6px;
  margin-top: -1mm; /* negative margin moves it up */
  overflow: hidden;
}


.qr-container {
  width: 12mm;
  height: 12mm;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 4px;
  padding: 1px;
  margin-top: 0; /* remove extra spacing */
}

         #qrcode {
  width: 10mm; /* reduced from 14mm */
  height: 10mm; /* reduced from 14mm */
}

        </style>
      </head>
      <body>
        <div class="card">
          <div class="card-header">
  <div>INTERNATIONAL PERSONAL</div>
  <div>HEALTH CARD</div>
</div>

          <div class="content">
            <div class="left-section">
              <img class="logo" src="${logo}" alt="Logo">
              <div class="details">
                <div class="patient-name">${patientName}</div>
                <div class="id-number">PHN: ${phn}</div>
              </div>
            </div>
            <div class="right-section">
              <div class="photo-placeholder">
                ${photoContent}
              </div>
              <div class="qr-container">
                <canvas id="qrcode"></canvas>
              </div>
            </div>
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js"></script>
        <script>
          window.onload = function() {
            const qrCanvas = document.getElementById('qrcode');
            QRCode.toCanvas(qrCanvas, "${phn}", {
            width: 50, 
            height: 50,
              margin: 1,
              color: {
                dark: "#000000",
                light: "#ffffff"
              }
            }, function(error) {
              if (error) console.error(error);
            });
            
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 300);
            }, 500);
          }
        </script>
      </body>
    </html>
  `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!formData.givenName || !formData.familyName) {
      showToast({
        title: 'Error',
        kind: 'error',
        description: 'Given name and family name are required',
      });
      setIsSubmitting(false);
      return;
    }

    if (!formData.dateOfBirth) {
      showToast({
        title: 'Error',
        kind: 'error',
        description: 'Date of birth is required',
      });
      setIsSubmitting(false);
      return;
    }

    if (!userLocation) {
      showToast({
        title: 'Error',
        kind: 'error',
        description: 'User location is not available. Please ensure you are logged in with a valid location.',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      Swal.fire({
        title: 'Registering Patient',
        html: 'Please wait while we process your request...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const phn = formData.existingPHN || getGeneratedPHN();
      const patientName = `${formData.givenName} ${formData.familyName}`;

      const birthdate = new Date(formData.dateOfBirth);
      const timezoneOffset = -birthdate.getTimezoneOffset() * 60 * 1000;
      const localBirthdate = new Date(birthdate.getTime() + timezoneOffset);
      const formattedBirthdate = localBirthdate.toISOString().replace('Z', '+0100');

      const patientPayload = {
        identifiers: [
          {
            identifier: phn,
            identifierType: '05a29f94-c0ed-11e2-94be-8c13b969e334',
            location: userLocation,
            preferred: true,
          },
        ],
        person: {
          gender: formData.gender === 'Male' ? 'M' : formData.gender === 'Female' ? 'F' : 'O',
          age: parseInt(formData.ageYears) || 0,
          birthdate: formattedBirthdate,
          names: [
            {
              givenName: formData.givenName,
              familyName: formData.familyName,
            },
          ],
          attributes: buildAttributes(),
        },
      };

      const patientResponse = await openmrsFetch('/ws/rest/v1/patient', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patientPayload),
      });

      if (!patientResponse.ok) {
        const errorBody = await patientResponse.json();
        let errorMessage = errorBody.error?.message || 'Patient creation failed';
        if (errorBody.error?.globalErrors?.length) {
          errorMessage = errorBody.error.globalErrors.map((e: any) => e.message).join(', ');
        }
        throw new Error(errorMessage);
      }

      Swal.close();

      const result = await Swal.fire({
        icon: 'success',
        title: 'Registration Successful!',
        html: `Patient registered successfully!<br><br><strong>PHN:</strong> ${phn}<br><strong>Location:</strong> ${session.sessionLocation?.display || 'Unknown'}`,
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#007bff',
        confirmButtonText: 'OK',
        cancelButtonText: 'Print PHN Card',
      });

      if (result.dismiss === Swal.DismissReason.cancel) {
        // Pass the image preview URL to the print function
        const imageData = formData.profileImage?.preview || null;
        printPHNCard(phn, patientName, imageData);
      }

      setFormData({
        existingPHN: '',
        unknownPatient: false,
        babyOf: false,
        title: '',
        givenName: '',
        familyName: '',
        nicNo: '',
        dateOfBirth: '',
        ageYears: '',
        ageMonths: '',
        ageDays: '',
        gender: 'Male',
        telephoneResidence: '',
        telephoneMobile: '',
        guardianName: '',
        guardianRelationship: '',
        guardianContactNo: '',
        profileImage: null,
      });
    } catch (error) {
      console.error('Registration error:', error);
      Swal.fire({
        icon: 'error',
        title: 'Registration Failed',
        text: (error as Error).message || 'An error occurred during registration',
        confirmButtonColor: '#dc3545',
        confirmButtonText: 'OK',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmReset = () => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will clear all form data. You cannot undo this action!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, clear it!',
    }).then((result) => {
      if (result.isConfirmed) {
        setFormData({
          existingPHN: '',
          unknownPatient: false,
          babyOf: false,
          title: '',
          givenName: '',
          familyName: '',
          nicNo: '',
          dateOfBirth: '',
          ageYears: '',
          ageMonths: '',
          ageDays: '',
          gender: 'Male',
          telephoneResidence: '',
          telephoneMobile: '',
          guardianName: '',
          guardianRelationship: '',
          guardianContactNo: '',
          profileImage: null,
        });
        showToast({
          title: 'Success',
          kind: 'success',
          description: 'Form has been cleared',
        });
      }
    });
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '30px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          }}
        >
          <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="sr-only">Loading...</span>
          </div>
          <h3 style={{ marginTop: '20px', color: '#333' }}>Loading form data...</h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#f5f5f5',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            padding: '30px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            maxWidth: '500px',
          }}
        >
          <div style={{ fontSize: '48px', color: '#dc3545', marginBottom: '20px' }}>⚠️</div>
          <h3 style={{ color: '#dc3545', marginBottom: '15px' }}>Error Loading Form Data</h3>
          <p style={{ color: '#666', marginBottom: '20px' }}>{error.message || 'An unknown error occurred'}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
      }}
    >
      <h2
        style={{
          color: '#28a745',
          marginBottom: '20px',
          fontSize: '24px',
          fontWeight: 'bold',
        }}
      >
        Register Patient
      </h2>

      {userLocation && (
        <div
          style={{
            marginBottom: '20px',
            padding: '10px',
            backgroundColor: '#e8f5e8',
            borderRadius: '4px',
            border: '1px solid #28a745',
          }}
        >
          <strong>Current Location:</strong> {session.sessionLocation?.display || 'Unknown'}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: '#ffffff',
          padding: '30px',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        }}
      >
        <div
          style={{
            marginBottom: '30px',
            maxWidth: '500px',
          }}
        >
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              color: '#333',
              fontSize: '14px',
            }}
          >
            Existing PHN
          </label>
          <input
            type="text"
            name="existingPHN"
            value={formData.existingPHN}
            onChange={handleInputChange}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
            placeholder="Enter existing PHN if patient has one"
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            marginBottom: '30px',
          }}
        >
          <div>
            <div style={{ marginBottom: '30px' }}>
              <h3
                style={{
                  color: '#333',
                  marginBottom: '20px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #28a745',
                  paddingBottom: '10px',
                }}
              >
                Basic Information
              </h3>

              <div style={{ marginBottom: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '30px',
                    alignItems: 'center',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontWeight: 'bold',
                      color: '#333',
                      fontSize: '14px',
                    }}
                  >
                    <input
                      type="checkbox"
                      name="unknownPatient"
                      checked={formData.unknownPatient}
                      onChange={handleInputChange}
                      style={{
                        marginRight: '8px',
                        transform: 'scale(1.2)',
                      }}
                    />
                    Unknown Patient
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontWeight: 'bold',
                      color: '#333',
                      fontSize: '14px',
                    }}
                  >
                    <input
                      type="checkbox"
                      name="babyOf"
                      checked={formData.babyOf}
                      onChange={handleInputChange}
                      style={{
                        marginRight: '8px',
                        transform: 'scale(1.2)',
                      }}
                    />
                    Baby Of
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Title
                </label>
                <select
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">--Select--</option>
                  <option value="Mr">Mr</option>
                  <option value="Mrs">Mrs</option>
                  <option value="Miss">Miss</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Given Name
                </label>
                <input
                  type="text"
                  name="givenName"
                  value={formData.givenName}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter given name"
                  required
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Family Name
                </label>
                <input
                  type="text"
                  name="familyName"
                  value={formData.familyName}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter family name"
                  required
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  NIC No
                </label>
                <input
                  type="text"
                  name="nicNo"
                  value={formData.nicNo}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter NIC number"
                />
              </div>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: '30px' }}>
              <h3
                style={{
                  color: '#333',
                  marginBottom: '20px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #28a745',
                  paddingBottom: '10px',
                }}
              >
                Personal Details
              </h3>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Date Of Birth
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Age
                </label>
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      name="ageYears"
                      value={formData.ageYears}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                      placeholder="Years"
                      min="0"
                      readOnly
                    />
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#666',
                        marginTop: '2px',
                        textAlign: 'center',
                      }}
                    >
                      Years
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      name="ageMonths"
                      value={formData.ageMonths}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                      placeholder="Months"
                      min="0"
                      max="11"
                      readOnly
                    />
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#666',
                        marginTop: '2px',
                        textAlign: 'center',
                      }}
                    >
                      Months
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      name="ageDays"
                      value={formData.ageDays}
                      onChange={handleInputChange}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '4px',
                        border: '1px solid #ccc',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                      placeholder="Days"
                      min="0"
                      max="30"
                      readOnly
                    />
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#666',
                        marginTop: '2px',
                        textAlign: 'center',
                      }}
                    >
                      Days
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Gender
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Profile Image
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '15px',
                  }}
                >
                  <div
                    style={{
                      width: '80px',
                      height: '80px',
                      border: '2px dashed #ccc',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      backgroundColor: '#f9f9f9',
                    }}
                  >
                    {formData.profileImage?.preview ? (
                      <img
                        src={formData.profileImage.preview}
                        alt="Profile preview"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '50%',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          fontSize: '24px',
                          color: '#ccc',
                        }}
                      >
                        📷
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      id="profile-image-upload"
                    />
                    <label
                      htmlFor="profile-image-upload"
                      style={{
                        display: 'inline-block',
                        padding: '8px 16px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 'bold',
                      }}
                    >
                      Choose Image
                    </label>
                    {formData.profileImage?.file && (
                      <div
                        style={{
                          marginTop: '5px',
                          fontSize: '12px',
                          color: '#666',
                        }}
                      >
                        {formData.profileImage.file.name}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>Max file size: 2MB</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: '30px' }}>
              <h3
                style={{
                  color: '#333',
                  marginBottom: '20px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #28a745',
                  paddingBottom: '10px',
                }}
              >
                Contact Information
              </h3>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Telephone (Residence)
                </label>
                <input
                  type="tel"
                  name="telephoneResidence"
                  value={formData.telephoneResidence}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter residence phone"
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Telephone (Mobile)
                </label>
                <input
                  type="tel"
                  name="telephoneMobile"
                  value={formData.telephoneMobile}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter mobile phone"
                />
              </div>
            </div>

            <div style={{ marginBottom: '30px' }}>
              <h3
                style={{
                  color: '#333',
                  marginBottom: '20px',
                  fontSize: '18px',
                  fontWeight: 'bold',
                  borderBottom: '2px solid #28a745',
                  paddingBottom: '10px',
                }}
              >
                Guardian Information
              </h3>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Guardian Name
                </label>
                <input
                  type="text"
                  name="guardianName"
                  value={formData.guardianName}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter guardian name"
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Guardian Relationship
                </label>
                <select
                  name="guardianRelationship"
                  value={formData.guardianRelationship}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">--Select--</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Sibling">Sibling</option>
                  <option value="Guardian">Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: 'bold',
                    color: '#333',
                    fontSize: '14px',
                  }}
                >
                  Guardian Contact No
                </label>
                <input
                  type="tel"
                  name="guardianContactNo"
                  value={formData.guardianContactNo}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder="Enter guardian contact number"
                />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '15px',
            marginTop: '30px',
          }}
        >
          <button
            type="button"
            style={{
              padding: '12px 30px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
            onClick={confirmReset}
          >
            New
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '12px 30px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PatientRegistrationForm;
